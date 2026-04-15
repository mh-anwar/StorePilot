import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { automations, automationRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AutomationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [a] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, Number(id)));
  if (!a) notFound();
  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, a.id))
    .orderBy(desc(automationRuns.startedAt))
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/automations"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to automations
        </Link>
        <h1 className="text-2xl font-bold mt-2">{a.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          &ldquo;{a.prompt}&rdquo;
        </p>
      </div>
      <div className="space-y-3">
        {runs.map((r) => (
          <div key={r.id} className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  r.status === "succeeded"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : r.status === "failed"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {r.status}
              </span>
              <span className="text-muted-foreground">
                {new Date(r.startedAt).toLocaleString()}
              </span>
              {r.finishedAt && (
                <span className="text-muted-foreground">
                  → finished in{" "}
                  {Math.round(
                    (new Date(r.finishedAt).getTime() -
                      new Date(r.startedAt).getTime()) /
                      1000
                  )}
                  s
                </span>
              )}
            </div>
            {r.toolCalls && r.toolCalls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.toolCalls.map((c, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
            {r.output && (
              <pre className="mt-3 text-xs whitespace-pre-wrap text-muted-foreground">
                {r.output}
              </pre>
            )}
            {r.error && (
              <p className="mt-3 text-xs text-red-400">{r.error}</p>
            )}
          </div>
        ))}
        {runs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No runs yet.
          </div>
        )}
      </div>
    </div>
  );
}
