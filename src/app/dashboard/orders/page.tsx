import { db } from "@/lib/db";
import { orders, customers } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  delivered: "bg-emerald-500/10 text-emerald-400",
  shipped: "bg-blue-500/10 text-blue-400",
  confirmed: "bg-amber-500/10 text-amber-400",
  pending: "bg-gray-500/10 text-gray-400",
  cancelled: "bg-red-500/10 text-red-400",
  refunded: "bg-red-500/10 text-red-400",
};

export default async function OrdersPage() {
  const orgId = await getCurrentOrgId();
  const allOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.orgId, orgId))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  void and;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm">
          Recent orders (showing latest 100)
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Order
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {order.customerFirstName} {order.customerLastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.customerEmail}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={statusColors[order.status] || ""}
                        variant="secondary"
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      ${parseFloat(order.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
