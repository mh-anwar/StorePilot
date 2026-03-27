import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Order {
  orderNumber: string;
  total: string;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  delivered: "bg-emerald-500/10 text-emerald-400",
  shipped: "bg-blue-500/10 text-blue-400",
  confirmed: "bg-amber-500/10 text-amber-400",
  pending: "bg-gray-500/10 text-gray-400",
  cancelled: "bg-red-500/10 text-red-400",
  refunded: "bg-red-500/10 text-red-400",
};

export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.orderNumber} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">
                  {order.orderNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge
                className={`text-xs ${statusColors[order.status] || ""}`}
                variant="secondary"
              >
                {order.status}
              </Badge>
              <span className="text-sm font-mono font-medium w-20 text-right">
                ${parseFloat(order.total).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
