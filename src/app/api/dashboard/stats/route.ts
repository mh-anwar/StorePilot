import { db } from "@/lib/db";
import { orders, products, customers } from "@/lib/db/schema";
import { sql, gte, count, sum, avg } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenueStats, productStats, customerStats, lowStockStats] =
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
      db.select({ count: count() }).from(products).where(sql`${products.status} = 'active'`),
      db.select({ count: count() }).from(customers),
      db
        .select({ count: count() })
        .from(products)
        .where(
          sql`${products.stock} <= ${products.lowStockThreshold} AND ${products.status} = 'active'`
        ),
    ]);

  return NextResponse.json({
    revenue30d: revenueStats[0].totalRevenue || "0",
    orderCount30d: revenueStats[0].orderCount,
    avgOrderValue: revenueStats[0].avgOrderValue || "0",
    totalProducts: productStats[0].count,
    totalCustomers: customerStats[0].count,
    lowStockAlerts: lowStockStats[0].count,
  });
}
