import Link from "next/link";
import { db } from "@/lib/db";
import { workflowRuns, workflows, proposals, auditLog } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const orgId = await getCurrentOrgId();
  const { status } = await searchParams;

  const runsQuery = db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      createdAt: workflowRuns.createdAt,
      finishedAt: workflowRuns.finishedAt,
      currentStep: workflowRuns.currentStep,
      error: workflowRuns.error,
      workflowId: workflowRuns.workflowId,
      workflowName: workflows.name,
    })
    .from(workflowRuns)
    .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
    .where(
      status
        ? and(eq(workflowRuns.orgId, orgId), eq(workflowRuns.status, status as never))
        : eq(workflowRuns.orgId, orgId)
    )
    .orderBy(desc(workflowRuns.createdAt))
    .limit(50);
  const runs = await runsQuery;

  const recentAudit = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.createdAt))
    .limit(25);

  const pendingCount = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.orgId, orgId), eq(proposals.status, "pending")));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-muted-foreground text-sm">
          Every workflow run and every write your agents have made.
          {pendingCount.length > 0 && (
            <>
              {" "}
              <Link href="/dashboard/proposals" className="underline">
                {pendingCount.length} proposals pending approval
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <div className="flex gap-2 text-xs">
        {["", "running", "succeeded", "failed", "awaiting_approval", "cancelled"].map(
          (s) => (
            <a
              key={s || "all"}
              href={s ? `?status=${s}` : "?"}
              className={`px-3 py-1.5 rounded-lg border ${
                (status ?? "") === s
                  ? "bg-violet-600 text-white border-violet-600"
                  : "border-border hover:bg-muted"
              }`}
            >
              {s || "all"}
            </a>
          )
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Runs</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Run</th>
                <th className="text-left px-4 py-2">Workflow</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/workflows/${r.workflowId}/runs/${r.id}`}
                      className="hover:underline"
                    >
                      {r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/workflows/${r.workflowId}`}
                      className="hover:underline"
                    >
                      {r.workflowName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        r.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : r.status === "failed"
                            ? "bg-red-500/10 text-red-400"
                            : r.status === "awaiting_approval"
                              ? "bg-amber-500/10 text-amber-400"
                              : r.status === "running"
                                ? "bg-sky-500/10 text-sky-400"
                                : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.finishedAt
                      ? `${Math.round(
                          (new Date(r.finishedAt).getTime() -
                            new Date(r.createdAt).getTime()) /
                            100
                        ) / 10}s`
                      : "…"}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-xs line-clamp-1">
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Recent agent writes</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Actor</th>
                <th className="text-left px-4 py-2">Tool</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {a.actor}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{a.toolName}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {a.target ?? ""}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={
                        a.status === "ok"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentAudit.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No writes recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
