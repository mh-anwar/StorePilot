import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  analyticsEvents,
  customers,
} from "@/lib/db/schema";
import { sql, and, gte, lte, desc, count, sum, avg, eq } from "drizzle-orm";

export const analyticsTools = {
  analytics__query_revenue: tool({
    description:
      "Query total revenue, order count, and average order value for a date range",
    inputSchema: z.object({
      startDate: z.string().describe("ISO date string for range start"),
      endDate: z.string().describe("ISO date string for range end"),
    }),
    execute: async ({ startDate, endDate }) => {
      const result = await db
        .select({
          totalRevenue: sum(orders.total),
          orderCount: count(orders.id),
          avgOrderValue: avg(orders.total),
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, new Date(startDate)),
            lte(orders.createdAt, new Date(endDate)),
            sql`${orders.status} NOT IN ('cancelled', 'refunded')`
          )
        );
      return {
        ...result[0],
        period: { startDate, endDate },
      };
    },
  }),

  analytics__top_products: tool({
    description: "Get top-selling products ranked by revenue or units sold",
    inputSchema: z.object({
      metric: z.enum(["revenue", "units"]).default("revenue"),
      limit: z.number().min(1).max(50).default(10),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    execute: async ({ metric, limit, startDate, endDate }) => {
      const conditions = [];
      if (startDate)
        conditions.push(gte(orders.createdAt, new Date(startDate)));
      if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));

      const result = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          totalRevenue: sum(orderItems.totalPrice),
          totalUnits: sum(orderItems.quantity),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(orderItems.productId, orderItems.productName)
        .orderBy(
          desc(
            metric === "revenue"
              ? sum(orderItems.totalPrice)
              : sum(orderItems.quantity)
          )
        )
        .limit(limit);

      return { metric, products: result };
    },
  }),

  analytics__revenue_over_time: tool({
    description: "Get revenue grouped by day/week/month for charting trends",
    inputSchema: z.object({
      granularity: z.enum(["day", "week", "month"]).default("day"),
      startDate: z.string(),
      endDate: z.string(),
    }),
    execute: async ({ granularity, startDate, endDate }) => {
      const result = await db.execute(sql`
        SELECT
          date_trunc(${granularity}, created_at) AS period,
          SUM(total::numeric) AS revenue,
          COUNT(*) AS order_count
        FROM orders
        WHERE created_at >= ${startDate}::timestamptz
          AND created_at <= ${endDate}::timestamptz
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY 1
        ORDER BY 1
      `);
      return { granularity, data: result.rows };
    },
  }),

  analytics__detect_anomalies: tool({
    description:
      "Detect anomalies in daily revenue or traffic by comparing to rolling averages",
    inputSchema: z.object({
      metric: z.enum(["revenue", "traffic"]),
      lookbackDays: z.number().default(30),
      thresholdStdDev: z.number().default(2),
    }),
    execute: async ({ metric, lookbackDays, thresholdStdDev }) => {
      const valueExpr =
        metric === "revenue"
          ? "SUM(total::numeric)"
          : "COUNT(*)";
      const tableName = metric === "revenue" ? "orders" : "analytics_events";

      const result = await db.execute(sql.raw(`
        WITH daily AS (
          SELECT date_trunc('day', created_at) AS day,
                 ${valueExpr} AS value
          FROM ${tableName}
          WHERE created_at >= NOW() - INTERVAL '${lookbackDays} days'
          GROUP BY 1
        ),
        stats AS (
          SELECT day, value,
                 AVG(value) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_avg,
                 STDDEV(value) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_std
          FROM daily
        )
        SELECT *,
               CASE WHEN ABS(value - rolling_avg) > ${thresholdStdDev} * COALESCE(NULLIF(rolling_std, 0), 1) THEN true ELSE false END AS is_anomaly
        FROM stats
        ORDER BY day
      `));
      return {
        metric,
        lookbackDays,
        threshold: thresholdStdDev,
        data: result.rows,
        anomalyCount: result.rows.filter((r: Record<string, unknown>) => r.is_anomaly).length,
      };
    },
  }),

  analytics__customer_segments: tool({
    description:
      "Analyze customer segments by total spend, order frequency, or recency",
    inputSchema: z.object({
      segmentBy: z.enum(["spend_tier", "frequency", "recency"]),
    }),
    execute: async ({ segmentBy }) => {
      if (segmentBy === "spend_tier") {
        const result = await db.execute(sql`
          SELECT
            CASE
              WHEN total_spent::numeric >= 500 THEN 'VIP ($500+)'
              WHEN total_spent::numeric >= 200 THEN 'Regular ($200-$499)'
              WHEN total_spent::numeric >= 50 THEN 'Occasional ($50-$199)'
              ELSE 'New (< $50)'
            END AS segment,
            COUNT(*) AS customer_count,
            SUM(total_spent::numeric) AS total_revenue,
            ROUND(AVG(total_orders), 1) AS avg_orders
          FROM customers
          GROUP BY 1
          ORDER BY total_revenue DESC
        `);
        return { segmentBy, segments: result.rows };
      }

      if (segmentBy === "frequency") {
        const result = await db.execute(sql`
          SELECT
            CASE
              WHEN total_orders >= 10 THEN 'Power Buyer (10+)'
              WHEN total_orders >= 5 THEN 'Loyal (5-9)'
              WHEN total_orders >= 2 THEN 'Repeat (2-4)'
              ELSE 'One-Time (1)'
            END AS segment,
            COUNT(*) AS customer_count,
            SUM(total_spent::numeric) AS total_revenue
          FROM customers
          WHERE total_orders > 0
          GROUP BY 1
          ORDER BY total_revenue DESC
        `);
        return { segmentBy, segments: result.rows };
      }

      // recency
      const result = await db.execute(sql`
        SELECT
          CASE
            WHEN last_order <= NOW() - INTERVAL '60 days' THEN 'At Risk (60+ days)'
            WHEN last_order <= NOW() - INTERVAL '30 days' THEN 'Cooling (30-60 days)'
            WHEN last_order <= NOW() - INTERVAL '7 days' THEN 'Active (7-30 days)'
            ELSE 'Hot (< 7 days)'
          END AS segment,
          COUNT(*) AS customer_count
        FROM (
          SELECT customer_id, MAX(created_at) AS last_order
          FROM orders
          GROUP BY customer_id
        ) sub
        JOIN customers ON customers.id = sub.customer_id
        GROUP BY 1
        ORDER BY 1
      `);
      return { segmentBy, segments: result.rows };
    },
  }),

  analytics__traffic_sources: tool({
    description:
      "Break down traffic and conversions by UTM source/medium/campaign",
    inputSchema: z.object({
      startDate: z.string(),
      endDate: z.string(),
      groupBy: z
        .enum(["source", "medium", "campaign"])
        .default("source"),
    }),
    execute: async ({ startDate, endDate, groupBy }) => {
      const groupCol =
        groupBy === "source"
          ? "utm_source"
          : groupBy === "medium"
            ? "utm_medium"
            : "utm_campaign";

      const result = await db.execute(sql.raw(`
        SELECT
          COALESCE(${groupCol}, 'direct') AS ${groupBy},
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) FILTER (WHERE event_type = 'purchase') AS purchases,
          ROUND(
            COUNT(*) FILTER (WHERE event_type = 'purchase')::numeric /
            NULLIF(COUNT(DISTINCT session_id), 0) * 100, 2
          ) AS conversion_rate
        FROM analytics_events
        WHERE created_at >= '${startDate}'::timestamptz
          AND created_at <= '${endDate}'::timestamptz
        GROUP BY 1
        ORDER BY sessions DESC
      `));
      return { groupBy, period: { startDate, endDate }, data: result.rows };
    },
  }),

  analytics__sales_by_category: tool({
    description: "Get sales breakdown by product category",
    inputSchema: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    execute: async ({ startDate, endDate }) => {
      const conditions = [
        sql`${orders.status} NOT IN ('cancelled', 'refunded')`,
      ];
      if (startDate)
        conditions.push(gte(orders.createdAt, new Date(startDate)));
      if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));

      const result = await db
        .select({
          category: products.category,
          totalRevenue: sum(orderItems.totalPrice),
          totalUnits: sum(orderItems.quantity),
          orderCount: count(sql`DISTINCT ${orderItems.orderId}`),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(and(...conditions))
        .groupBy(products.category)
        .orderBy(desc(sum(orderItems.totalPrice)));

      return { categories: result };
    },
  }),
};
