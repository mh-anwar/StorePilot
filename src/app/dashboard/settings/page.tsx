import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = await db.select().from(storeSettings);
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Store preferences and AI key configuration
        </p>
      </div>
      <SettingsForm initial={map} />
    </div>
  );
}
