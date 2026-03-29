import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { sql, gte, count, sum, avg, eq, desc } from "drizzle-orm";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopProductsTable } from "@/components/dashboard/top-products-table";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Package,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenueStats, lowStock, topProducts, recentOrders, dailyRevenue] =
    await Promise.all([
      db
        .select({
          totalRevenue: sum(orders.total),
          orderCount: count(),
          avgOrderValue: avg(orders.total),
        })
        .from(orders)
        .where(
          sql`${orders.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz AND ${orders.status} NOT IN ('cancelled', 'refunded')`
        ),
      db
        .select({ count: count() })
        .from(products)
        .where(
          sql`${products.stock} <= ${products.lowStockThreshold} AND ${products.status} = 'active'`
        ),
      db
        .select({
          productName: orderItems.productName,
          totalRevenue: sum(orderItems.totalPrice),
          totalUnits: sum(orderItems.quantity),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          sql`${orders.status} NOT IN ('cancelled', 'refunded')`
        )
        .groupBy(orderItems.productName)
        .orderBy(desc(sum(orderItems.totalPrice)))
        .limit(8),
      db
        .select({
          orderNumber: orders.orderNumber,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(8),
      db.execute(sql`
        SELECT
          date_trunc('day', created_at)::date AS date,
          SUM(total::numeric) AS revenue,
          COUNT(*) AS orders
        FROM orders
        WHERE created_at >= ${thirtyDaysAgo.toISOString()}::timestamptz
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

  const revenue = parseFloat(revenueStats[0].totalRevenue || "0");
  const avgOV = parseFloat(revenueStats[0].avgOrderValue || "0");

  const chartData = (dailyRevenue.rows as Array<Record<string, unknown>>).map(
    (row) => ({
      date: new Date(row.date as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      revenue: parseFloat(String(row.revenue)),
      orders: Number(row.orders),
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Store performance over the last 30 days
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Revenue"
          value={`$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Last 30 days"
          icon={DollarSign}
        />
        <KpiCard
          title="Orders"
          value={revenueStats[0].orderCount.toLocaleString()}
          subtitle="Last 30 days"
          icon={ShoppingCart}
        />
        <KpiCard
          title="Avg Order Value"
          value={`$${avgOV.toFixed(2)}`}
          subtitle="Last 30 days"
          icon={TrendingUp}
        />
        <KpiCard
          title="Low Stock Alerts"
          value={String(lowStock[0].count)}
          subtitle="Products below threshold"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueChart data={chartData} />
        <TopProductsTable
          products={topProducts.map((p) => ({
            productName: p.productName,
            totalRevenue: String(p.totalRevenue || 0),
            totalUnits: String(p.totalUnits || 0),
          }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentOrders
          orders={recentOrders.map((o) => ({
            orderNumber: o.orderNumber,
            total: o.total,
            status: o.status,
            createdAt: o.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
