import Link from "next/link";
import { db } from "@/lib/db";
import { orders, customers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const jar = await cookies();
  const lastOrder = jar.get("sp_last_order")?.value;

  let myOrders: Array<{
    orderNumber: string;
    total: string;
    status: string;
    createdAt: Date;
  }> = [];
  let customer: typeof customers.$inferSelect | null = null;
  if (email) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email.toLowerCase()));
    if (c) {
      customer = c;
      myOrders = await db
        .select({
          orderNumber: orders.orderNumber,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.customerId, c.id))
        .orderBy(desc(orders.createdAt))
        .limit(20);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Look up orders by email — demo sites keep things simple.
      </p>
      {lastOrder && (
        <div className="mt-5 border border-border rounded-xl p-4 text-sm">
          <p className="text-muted-foreground">Your last order:</p>
          <Link
            href={`/shop/order/${lastOrder}`}
            className="font-mono font-semibold hover:underline"
          >
            {lastOrder}
          </Link>
        </div>
      )}
      <form className="mt-8 flex gap-2">
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          defaultValue={email ?? ""}
          className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        />
        <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm">
          Look up
        </button>
      </form>
      {customer && (
        <div className="mt-8">
          <h2 className="font-semibold mb-2">
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {customer.totalOrders} orders · $
            {parseFloat(customer.totalSpent ?? "0").toFixed(2)} lifetime
          </p>
          <div className="mt-4 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Order</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.map((o) => (
                  <tr key={o.orderNumber} className="border-t border-border">
                    <td className="px-4 py-2 font-mono">
                      <Link href={`/shop/order/${o.orderNumber}`} className="hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
