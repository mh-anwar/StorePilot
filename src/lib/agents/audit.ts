// Wrap any tool execute() so every write is persisted to the audit log
// with (who, what, args, result, status). Reads are not audited — too
// noisy. Callers mark a tool as "writing" with the `writes` flag on
// `auditTool()`. The audit module is tolerant: failure to write an audit
// row must never block a legitimate tool call.

import { db } from "../db";
import { auditLog } from "../db/schema";

// Actor format: `<kind>:<id>`. Kind is the source of the write — an
// explicit agent, a workflow run, an automation run, a signed-in user,
// or the platform itself (for system/backfill writes).
export type Actor =
  | `agent:${string}`
  | `workflow:${string}`
  | `automation:${string}`
  | `user:${string}`
  | `system:${string}`;

export async function recordAudit(args: {
  orgId: string;
  actor: Actor;
  toolName: string;
  target?: string;
  args?: unknown;
  result?: unknown;
  status?: "ok" | "error";
  error?: string;
}) {
  try {
    await db.insert(auditLog).values({
      orgId: args.orgId,
      actor: args.actor,
      toolName: args.toolName,
      target: args.target ?? null,
      args: args.args as Record<string, unknown> | null,
      result: args.result as Record<string, unknown> | null,
      status: args.status ?? "ok",
      error: args.error ?? null,
    });
  } catch (e) {
    // Intentionally swallow — audit is best-effort.
    console.error("audit write failed", (e as Error).message);
  }
}
