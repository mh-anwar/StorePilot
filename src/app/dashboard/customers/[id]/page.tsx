import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { customers, orders } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [c] = await db.select().from(customers).where(eq(customers.id, Number(id)));
  if (!c) notFound();
  const os = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, c.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/customers" className="text-xs text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {c.firstName} {c.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">{c.email}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Lifetime spend</p>
          <p className="text-2xl font-bold mt-1">
            ${parseFloat(c.totalSpent ?? "0").toFixed(2)}
          </p>
        </div>
        <div className="border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Orders</p>
          <p className="text-2xl font-bold mt-1">{c.totalOrders}</p>
        </div>
        <div className="border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Location</p>
          <p className="text-lg mt-1">
            {c.city ?? "—"}
            {c.state && `, ${c.state}`}
          </p>
        </div>
      </div>
      <div>
        <h2 className="font-semibold mb-3">Order history</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Order</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {os.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{o.orderNumber}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    ${parseFloat(o.total).toFixed(2)}
                  </td>
                </tr>
              ))}
              {os.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No orders yet.
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
