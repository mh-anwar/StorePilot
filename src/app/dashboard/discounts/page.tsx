import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { DiscountsAdmin } from "@/components/dashboard/discounts-admin";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  const rows = await db
    .select()
    .from(discounts)
    .orderBy(desc(discounts.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discounts</h1>
        <p className="text-muted-foreground text-sm">
          Codes that customers can apply at checkout
        </p>
      </div>
      <DiscountsAdmin initial={rows.map(serialize)} />
    </div>
  );
}

function serialize(d: typeof discounts.$inferSelect) {
  return {
    id: d.id,
    code: d.code,
    description: d.description,
    type: d.type,
    value: d.value,
    minSubtotal: d.minSubtotal,
    usageLimit: d.usageLimit,
    usageCount: d.usageCount,
    active: d.active,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}
