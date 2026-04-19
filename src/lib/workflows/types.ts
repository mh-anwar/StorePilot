// Workflow engine types. The executor is handler-registry driven; each
// step type registers a handler that takes resolved config + a run
// context and returns an output (stored on step_runs.output and merged
// into the run's rolling `context` so downstream steps can reference it).
import type { WorkflowStep } from "@/lib/db/schema";

export type { WorkflowStep };

export type RunContext = {
  runId: string;
  workflowId: string;
  orgId: string;
  trigger: Record<string, unknown>;
  /**
   * Outputs keyed by step id. e.g. ctx.steps.analyze.output.fraud_score
   */
  steps: Record<string, { output: unknown }>;
  /**
   * Current user-initiated actor (when a manual run was kicked off).
   */
  actor?: string;
};

export type StepResult =
  | { status: "ok"; output: unknown; summary?: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string }
  /**
   * Special: the step generated a proposal that must be approved
   * before the workflow can continue. The executor suspends the run.
   */
  | {
      status: "awaiting_approval";
      proposal: {
        actionType: string;
        actionConfig: Record<string, unknown>;
        summary?: string;
        rationale?: string;
      };
    };

export type StepHandler = (
  step: WorkflowStep,
  resolvedConfig: Record<string, unknown>,
  ctx: RunContext
) => Promise<StepResult>;

export type StepHandlerInfo = {
  description: string;
  /**
   * Optional category for UI grouping (e.g. "Store", "Notify", "LLM").
   */
  category: string;
  configSchema?: Record<string, unknown>;
  handler: StepHandler;
};
