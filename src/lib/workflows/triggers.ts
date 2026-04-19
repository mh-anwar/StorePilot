// Trigger dispatch: converts external events into workflow runs.
//   fanoutShopifyTrigger(topic)  → find workflows with trigger={type:'shopify', topic}
//   fanoutSchedule()             → find due schedule-triggered workflows
//   runFromHttp(workflowId, body) → HTTP-triggered external runs
//   runManual(workflowId, actor) → UI "Run now" button
import { db } from "../db";
import { workflows, webhookEvents } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { enqueue } from "../queue";
import { createRun, runWorkflow } from "./executor";

export async function fanoutShopifyTrigger(args: {
  shopId: string;
  topic: string;
  webhookId: string;
}) {
  // Look up the webhook payload once and pass it as trigger data.
  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.shopId, args.shopId),
        eq(webhookEvents.webhookId, args.webhookId)
      )
    );
  const payload = event?.payload ?? {};

  // JSONB containment match: trigger @> {type:'shopify', topic:X}
  const matches = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.status, "active"),
        sql`${workflows.trigger} @> ${JSON.stringify({ type: "shopify", topic: args.topic })}::jsonb`
      )
    );

  for (const wf of matches) {
    const runId = await createRun({
      workflowId: wf.id,
      orgId: wf.orgId,
      triggerData: { shopId: args.shopId, topic: args.topic, payload },
    });
    await enqueue("workflow.run", { runId });
  }
}

export async function fanoutSchedule() {
  // Naive minute-bucket scheduler: any workflow with
  // trigger={type:'schedule', intervalMinutes:N} whose last_run_at is
  // older than N minutes gets a run. (Cron parsing lives on a follow-up.)
  const all = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.status, "active"),
        sql`${workflows.trigger} @> '{"type":"schedule"}'::jsonb`
      )
    );

  const now = Date.now();
  let triggered = 0;
  for (const wf of all) {
    const t = wf.trigger as { type: "schedule"; intervalMinutes?: number };
    const interval = t.intervalMinutes ?? 60;
    const last = wf.lastRunAt ? new Date(wf.lastRunAt).getTime() : 0;
    if (now - last < interval * 60 * 1000) continue;

    const runId = await createRun({
      workflowId: wf.id,
      orgId: wf.orgId,
      triggerData: { scheduledAt: new Date().toISOString() },
    });
    await enqueue("workflow.run", { runId });
    triggered++;
  }
  return triggered;
}

export async function runFromHttp(args: {
  workflowId: string;
  orgId: string;
  body: Record<string, unknown>;
}): Promise<{ runId: string }> {
  const runId = await createRun({
    workflowId: args.workflowId,
    orgId: args.orgId,
    triggerData: args.body,
  });
  await enqueue("workflow.run", { runId });
  return { runId };
}

export async function runManual(args: {
  workflowId: string;
  orgId: string;
  actor: string;
  triggerData?: Record<string, unknown>;
  inline?: boolean;
}): Promise<{ runId: string }> {
  const runId = await createRun({
    workflowId: args.workflowId,
    orgId: args.orgId,
    triggerData: args.triggerData ?? {},
    actor: args.actor,
  });
  if (args.inline) {
    await runWorkflow(runId);
  } else {
    await enqueue("workflow.run", { runId });
  }
  return { runId };
}
