import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { workflows, workflowRuns } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";
import { WorkflowEditor } from "@/components/dashboard/workflow-editor";
import { listStepTypes } from "@/lib/workflows/handlers";

export const dynamic = "force-dynamic";

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const [wf] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)));
  if (!wf) notFound();

  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, wf.id))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(15);

  const stepTypes = listStepTypes();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/workflows"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to workflows
        </Link>
      </div>

      <WorkflowEditor
        workflow={{
          id: wf.id,
          name: wf.name,
          description: wf.description,
          status: wf.status,
          trigger: wf.trigger,
          steps: wf.steps,
        }}
        stepTypes={stepTypes}
      />

      <div>
        <h2 className="font-semibold mb-3">Recent runs</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Run</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">Step</th>
                <th className="text-left px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/workflows/${wf.id}/runs/${r.id}`}
                      className="hover:underline"
                    >
                      {r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        r.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : r.status === "failed"
                            ? "bg-red-500/10 text-red-400"
                            : r.status === "awaiting_approval"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    step {r.currentStep + 1}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-xs line-clamp-1">
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No runs yet. Click &quot;Run now&quot; to test the workflow.
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
