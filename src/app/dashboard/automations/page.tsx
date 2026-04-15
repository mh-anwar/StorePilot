import { db } from "@/lib/db";
import { automations, automationRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { AutomationsAdmin } from "@/components/dashboard/automations-admin";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const rows = await db
    .select()
    .from(automations)
    .orderBy(desc(automations.createdAt));

  const lastRuns: Record<number, { status: string; startedAt: string } | null> =
    {};
  for (const a of rows) {
    const [last] = await db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, a.id))
      .orderBy(desc(automationRuns.startedAt))
      .limit(1);
    lastRuns[a.id] = last
      ? { status: last.status, startedAt: last.startedAt.toISOString() }
      : null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automations</h1>
        <p className="text-muted-foreground text-sm">
          Natural-language jobs that run StorePilot agents — triggered manually
          or on schedule.
        </p>
      </div>
      <AutomationsAdmin
        initial={rows.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          lastRunAt: a.lastRunAt ? a.lastRunAt.toISOString() : null,
          lastRun: lastRuns[a.id],
        }))}
      />
    </div>
  );
}
