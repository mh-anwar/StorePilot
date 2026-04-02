import { db } from "@/lib/db";
import { orders, orderItems, products, analyticsEvents } from "@/lib/db/schema";
import { sql, eq, desc, sum, count } from "drizzle-orm";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [dailyRevenue, categoryBreakdown, trafficSources, conversionFunnel] =
    await Promise.all([
      db.execute(sql`
        SELECT
          date_trunc('day', created_at)::date AS date,
          SUM(total::numeric) AS revenue,
          COUNT(*) AS orders
        FROM orders
        WHERE created_at >= ${sixtyDaysAgo.toISOString()}::timestamptz
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY 1
        ORDER BY 1
      `),
      db
        .select({
          category: products.category,
          totalRevenue: sum(orderItems.totalPrice),
          totalUnits: sum(orderItems.quantity),
          orderCount: count(sql`DISTINCT ${orderItems.orderId}`),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(sql`${orders.status} NOT IN ('cancelled', 'refunded')`)
        .groupBy(products.category)
        .orderBy(desc(sum(orderItems.totalPrice))),
      db.execute(sql`
        SELECT
          COALESCE(utm_source, 'direct') AS source,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) FILTER (WHERE event_type = 'purchase') AS purchases
        FROM analytics_events
        WHERE created_at >= ${sixtyDaysAgo.toISOString()}::timestamptz
        GROUP BY 1
        ORDER BY sessions DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT
          event_type,
          COUNT(*) AS event_count,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM analytics_events
        WHERE created_at >= ${sixtyDaysAgo.toISOString()}::timestamptz
        GROUP BY 1
        ORDER BY event_count DESC
      `),
    ]);

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
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Store analytics over the last 60 days
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueChart data={chartData} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => {
                const revenue = parseFloat(String(cat.totalRevenue || 0));
                const totalRev = categoryBreakdown.reduce(
                  (s, c) => s + parseFloat(String(c.totalRevenue || 0)),
                  0
                );
                const pct = totalRev > 0 ? (revenue / totalRev) * 100 : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{cat.category}</span>
                      <span className="font-mono text-muted-foreground">
                        ${revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(trafficSources.rows as Array<Record<string, unknown>>).map(
                (source) => (
                  <div
                    key={String(source.source)}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {String(source.source)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {Number(source.sessions).toLocaleString()} sessions
                      </span>
                      <span className="font-medium">
                        {Number(source.purchases)} purchases
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(conversionFunnel.rows as Array<Record<string, unknown>>).map(
                (step) => {
                  const maxCount = Math.max(
                    ...(
                      conversionFunnel.rows as Array<Record<string, unknown>>
                    ).map((r) => Number(r.event_count))
                  );
                  const pct = (Number(step.event_count) / maxCount) * 100;
                  return (
                    <div key={String(step.event_type)} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">
                          {String(step.event_type).replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {Number(step.event_count).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
