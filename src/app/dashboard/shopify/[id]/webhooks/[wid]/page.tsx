import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { webhookEvents, shops } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function WebhookEventPage({
  params,
}: {
  params: Promise<{ id: string; wid: string }>;
}) {
  const { id, wid } = await params;
  const orgId = await getCurrentOrgId();
  const [shop] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.id, id), eq(shops.orgId, orgId)));
  if (!shop) notFound();

  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.shopId, shop.id), eq(webhookEvents.id, Number(wid))));
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/shopify/${shop.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to {shop.shopDomain}
        </Link>
        <h1 className="text-2xl font-bold mt-2 font-mono">{event.topic}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(event.receivedAt).toLocaleString()} · webhook id{" "}
          <span className="font-mono">{event.webhookId}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Processed" value={event.processedAt ? new Date(event.processedAt).toLocaleString() : "—"} />
        <Row label="Error" value={event.error ?? "—"} />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Payload</h2>
        <pre className="bg-muted/50 rounded-xl p-4 overflow-auto text-xs">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="font-mono text-sm mt-1 break-all">{value}</p>
    </div>
  );
}
