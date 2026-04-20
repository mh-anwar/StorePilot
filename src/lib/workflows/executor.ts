// Workflow executor. Runs a workflow's steps in order against a trigger
// payload. Produces step_runs records as it goes, writes the final status
// to workflow_runs, and when a step gates on approval, persists a
// `proposals` row and suspends the run.
//
// Resume-after-approval: a workflow_run in status=awaiting_approval has
// `current_step` pointing at the gated step. When the proposal resolves
// to `approved` we enqueue a resume job that calls `runWorkflow` again
// with the existing run row — it picks up from current_step and, because
// the proposal is now approved, executes the step normally.
import { db } from "../db";
import {
  workflows,
  workflowRuns,
  stepRuns,
  proposals,
  type WorkflowStep,
} from "../db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { resolve } from "./template";
import { getHandler } from "./registry";
import type { RunContext, StepResult } from "./types";
import { recordAudit } from "../agents/audit";

export async function createRun(args: {
  workflowId: string;
  orgId: string;
  triggerData: Record<string, unknown>;
  actor?: string;
}): Promise<string> {
  const id = "wr_" + nanoid(14);
  // Freeze the workflow's steps at creation time so later edits don't
  // retroactively change this run's behaviour. The executor reads
  // stepsSnapshot first; if it's missing (legacy runs), it falls back
  // to the live workflow.steps.
  const [wf] = await db
    .select({ steps: workflows.steps, version: workflows.version })
    .from(workflows)
    .where(eq(workflows.id, args.workflowId));
  await db.insert(workflowRuns).values({
    id,
    workflowId: args.workflowId,
    orgId: args.orgId,
    status: "queued",
    triggerData: args.triggerData,
    context: { actor: args.actor ?? null },
    stepsSnapshot: wf?.steps ?? null,
    workflowVersion: wf?.version ?? null,
  });
  return id;
}

export async function runWorkflow(runId: string): Promise<void> {
  const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId));
  if (!run) throw new Error(`run ${runId} not found`);
  if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
    return;
  }

  const [wf] = await db.select().from(workflows).where(eq(workflows.id, run.workflowId));
  if (!wf) throw new Error(`workflow ${run.workflowId} not found`);

  await db
    .update(workflowRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(workflowRuns.id, runId));

  // Rebuild the context from any prior step outputs so references work on resume.
  const priorSteps = await db
    .select()
    .from(stepRuns)
    .where(eq(stepRuns.runId, runId));
  const stepCtx: Record<string, { output: unknown }> = {};
  for (const s of priorSteps) {
    if (s.output !== null && s.status === "succeeded") {
      stepCtx[s.stepId] = { output: s.output };
    }
  }
  const ctx: RunContext = {
    runId,
    workflowId: wf.id,
    orgId: wf.orgId,
    trigger: run.triggerData,
    steps: stepCtx,
    actor: (run.context as { actor?: string })?.actor,
  };

  // Prefer the snapshot so in-flight runs are insulated from edits.
  const steps = (run.stepsSnapshot ?? wf.steps) as WorkflowStep[];
  for (let i = run.currentStep; i < steps.length; i++) {
    const step = steps[i];
    const handler = getHandler(step.type);

    const stepRunValues = {
      runId,
      stepIndex: i,
      stepId: step.id,
      stepType: step.type,
      status: "running" as const,
    };
    const [sr] = await db.insert(stepRuns).values(stepRunValues).returning({ id: stepRuns.id });

    if (!handler) {
      await markStepRun(sr.id, {
        status: "failed",
        error: `no handler for step type '${step.type}'`,
      });
      await failRun(runId, `no handler for step type '${step.type}'`);
      return;
    }

    // Resolve variables in the step config.
    let resolvedConfig: Record<string, unknown>;
    try {
      resolvedConfig = resolve(step.config, ctx) as Record<string, unknown>;
    } catch (e) {
      await markStepRun(sr.id, {
        status: "failed",
        error: `config resolution failed: ${(e as Error).message}`,
      });
      await failRun(runId, (e as Error).message);
      return;
    }

    await db
      .update(stepRuns)
      .set({ input: resolvedConfig })
      .where(eq(stepRuns.id, sr.id));

    let result: StepResult;
    try {
      result = await handler(step, resolvedConfig, ctx);
    } catch (e) {
      result = { status: "error", error: (e as Error).message };
    }

    if (result.status === "ok") {
      await markStepRun(sr.id, { status: "succeeded", output: result.output });
      ctx.steps[step.id] = { output: result.output };
      continue;
    }

    if (result.status === "skipped") {
      await markStepRun(sr.id, { status: "skipped", output: { reason: result.reason } });
      continue;
    }

    if (result.status === "stop") {
      // Gate short-circuit — finish the run cleanly without running the
      // remaining steps. We mark the gating step as "skipped" so the
      // UI shows it didn't "execute", and the run as "succeeded".
      await markStepRun(sr.id, {
        status: "skipped",
        output: { stopped: true, reason: result.reason ?? "condition was false" },
      });
      await db
        .update(workflowRuns)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          currentStep: i + 1,
        })
        .where(eq(workflowRuns.id, runId));
      await db
        .update(workflows)
        .set({ lastRunAt: new Date() })
        .where(eq(workflows.id, wf.id));
      return;
    }

    if (result.status === "awaiting_approval") {
      // Suspend. Store the resolved action so the approver sees exactly
      // what will happen, and remember the step index so we resume here.
      const proposalId = "prop_" + nanoid(14);
      await db.insert(proposals).values({
        id: proposalId,
        orgId: wf.orgId,
        runId,
        stepId: step.id,
        actionType: result.proposal.actionType,
        actionConfig: result.proposal.actionConfig,
        summary: result.proposal.summary ?? null,
        rationale: result.proposal.rationale ?? null,
        status: "pending",
      });
      await markStepRun(sr.id, {
        status: "awaiting_approval",
        output: { proposalId },
      });
      await db
        .update(workflowRuns)
        .set({ status: "awaiting_approval", currentStep: i })
        .where(eq(workflowRuns.id, runId));
      return;
    }

    // error
    if (step.onError === "continue") {
      await markStepRun(sr.id, { status: "failed", error: result.error });
      continue;
    }
    await markStepRun(sr.id, { status: "failed", error: result.error });
    await failRun(runId, result.error);
    return;
  }

  // All steps completed.
  await db
    .update(workflowRuns)
    .set({
      status: "succeeded",
      finishedAt: new Date(),
      context: { ...(run.context as object), steps: ctx.steps },
      currentStep: steps.length,
    })
    .where(eq(workflowRuns.id, runId));

  await db
    .update(workflows)
    .set({ lastRunAt: new Date() })
    .where(eq(workflows.id, wf.id));

  await recordAudit({
    orgId: wf.orgId,
    actor: `workflow:${runId}`,
    toolName: `workflow.run.${wf.name}`,
    target: wf.id,
    args: run.triggerData,
    result: { runId, steps: steps.length },
  });
}

async function markStepRun(
  id: number,
  patch: {
    status: "succeeded" | "failed" | "skipped" | "awaiting_approval";
    output?: unknown;
    error?: string;
  }
) {
  await db
    .update(stepRuns)
    .set({
      status: patch.status,
      output: (patch.output ?? null) as never,
      error: patch.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(stepRuns.id, id));
}

async function failRun(runId: string, error: string) {
  await db
    .update(workflowRuns)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(eq(workflowRuns.id, runId));
}

// Resume-after-approval: move past the gated step using the proposal's
// applied_result as its output, then continue the workflow.
export async function resumeAfterProposal(proposalId: string, appliedResult: unknown) {
  const [p] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!p || !p.runId) return;
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, p.runId));
  if (!run) return;

  // Find the step_run we suspended on and flip it to succeeded with the result.
  await db
    .update(stepRuns)
    .set({
      status: "succeeded",
      output: appliedResult as never,
      finishedAt: new Date(),
    })
    .where(
      and(eq(stepRuns.runId, run.id), eq(stepRuns.stepIndex, run.currentStep))
    );

  await db
    .update(workflowRuns)
    .set({ status: "running", currentStep: run.currentStep + 1 })
    .where(eq(workflowRuns.id, run.id));

  await runWorkflow(run.id);
}
