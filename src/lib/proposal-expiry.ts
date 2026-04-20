// Expire pending proposals older than a cutoff, and mark their runs
// as cancelled so the UI doesn't leave runs hanging forever in
// "awaiting_approval".
import { db } from "./db";
import { proposals, workflowRuns } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";

const DEFAULT_EXPIRY_HOURS = Number(process.env.PROPOSAL_EXPIRY_HOURS || 72);

export async function expireOldProposals(options: { hours?: number } = {}) {
  const hours = options.hours ?? DEFAULT_EXPIRY_HOURS;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const stale = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.status, "pending"),
        sql`${proposals.createdAt} < ${cutoff.toISOString()}::timestamptz`
      )
    );
  if (stale.length === 0) return { expired: 0 };

  for (const p of stale) {
    await db
      .update(proposals)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(proposals.id, p.id));
    if (p.runId) {
      await db
        .update(workflowRuns)
        .set({ status: "cancelled", finishedAt: new Date(), error: "proposal expired" })
        .where(
          and(
            eq(workflowRuns.id, p.runId),
            eq(workflowRuns.status, "awaiting_approval")
          )
        );
    }
  }
  return { expired: stale.length };
}
