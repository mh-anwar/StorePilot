import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { products, shops } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { recordAudit } from "../audit";
import { getCurrentOrgId } from "@/lib/tenant";
import { adminContext, adminGraphql } from "@/lib/shopify/admin";

export const inventoryTools = {
  inventory__check_stock_levels: tool({
    description:
      "List products that are below their low stock threshold or out of stock",
    inputSchema: z.object({
      includeOutOfStock: z.boolean().default(true),
      category: z.string().optional(),
    }),
    execute: async ({ includeOutOfStock, category }) => {
      const conditions = [
        sql`${products.stock} <= ${products.lowStockThreshold}`,
        eq(products.status, "active"),
      ];
      if (!includeOutOfStock) {
        conditions.push(sql`${products.stock} > 0`);
      }
      if (category) {
        conditions.push(eq(products.category, category));
      }

      const result = await db
        .select({
          id: products.id,
          name: products.name,
          category: products.category,
          sku: products.sku,
          stock: products.stock,
          lowStockThreshold: products.lowStockThreshold,
          price: products.price,
          vendor: products.vendor,
        })
        .from(products)
        .where(and(...conditions))
        .orderBy(products.stock);

      return {
        alertCount: result.length,
        outOfStock: result.filter((p) => p.stock === 0).length,
        lowStock: result.filter((p) => p.stock! > 0).length,
        products: result,
      };
    },
  }),

  inventory__restock_recommendations: tool({
    description:
      "Analyze sales velocity and recommend reorder quantities for products",
    inputSchema: z.object({
      daysToAnalyze: z.number().default(30).describe("Days of sales history to analyze"),
      targetDaysOfStock: z
        .number()
        .default(30)
        .describe("How many days of stock to maintain"),
      category: z.string().optional(),
    }),
    execute: async ({ daysToAnalyze, targetDaysOfStock, category }) => {
      const startDate = new Date(
        Date.now() - daysToAnalyze * 24 * 60 * 60 * 1000
      );

      const result = await db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.category,
          p.sku,
          p.stock,
          p.low_stock_threshold,
          p.cost_per_item,
          p.vendor,
          COALESCE(SUM(oi.quantity), 0) AS units_sold_period,
          ROUND(COALESCE(SUM(oi.quantity), 0)::numeric / ${daysToAnalyze}, 2) AS daily_velocity,
          CASE
            WHEN COALESCE(SUM(oi.quantity), 0) = 0 THEN 999
            ELSE ROUND(p.stock::numeric / (COALESCE(SUM(oi.quantity), 0)::numeric / ${daysToAnalyze}), 1)
          END AS days_of_stock_remaining,
          GREATEST(
            CEIL(
              (COALESCE(SUM(oi.quantity), 0)::numeric / ${daysToAnalyze}) * ${targetDaysOfStock}
              - p.stock
            ),
            0
          ) AS recommended_reorder
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id
          AND o.created_at >= ${startDate.toISOString()}::timestamptz
          AND o.status NOT IN ('cancelled', 'refunded')
        WHERE p.status = 'active'
          ${category ? sql`AND p.category = ${category}` : sql``}
        GROUP BY p.id, p.name, p.category, p.sku, p.stock, p.low_stock_threshold, p.cost_per_item, p.vendor
        HAVING COALESCE(SUM(oi.quantity), 0) > 0
        ORDER BY days_of_stock_remaining ASC
      `);

      const recommendations = result.rows as Array<Record<string, unknown>>;
      const urgent = recommendations.filter(
        (r) => Number(r.days_of_stock_remaining) < 7
      );
      const totalReorderCost = recommendations.reduce((sum, r) => {
        const cost = r.cost_per_item ? Number(r.cost_per_item) : 0;
        return sum + cost * Number(r.recommended_reorder);
      }, 0);

      return {
        analysisWindow: `${daysToAnalyze} days`,
        targetStock: `${targetDaysOfStock} days`,
        urgentCount: urgent.length,
        totalReorderCost: `$${totalReorderCost.toFixed(2)}`,
        recommendations: recommendations.slice(0, 20),
      };
    },
  }),

  inventory__update_stock: tool({
    description:
      "Update the stock quantity for a product (restock or adjustment)",
    inputSchema: z.object({
      productId: z.number(),
      newStock: z.number().min(0),
      reason: z.string().describe("Reason for the stock change"),
    }),
    execute: async ({ productId, newStock, reason }) => {
      const orgId = await getCurrentOrgId();
      const [product] = await db
        .select({
          id: products.id,
          name: products.name,
          stock: products.stock,
          shopId: products.shopId,
          shopifyGid: products.shopifyGid,
        })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.orgId, orgId)))
        .limit(1);

      if (!product) {
        await recordAudit({
          orgId,
          actor: "agent:inventory",
          toolName: "inventory__update_stock",
          args: { productId, newStock, reason },
          status: "error",
          error: "not found",
        });
        return { error: `Product ${productId} not found` };
      }

      const previousStock = product.stock;

      try {
        // Shopify-backed product? Push the change to the Admin API first.
        if (product.shopId && product.shopifyGid) {
          await updateShopifyInventory(product.shopId, product.shopifyGid, newStock);
        }
        await db
          .update(products)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(products.id, productId));

        const result = {
          productId,
          productName: product.name,
          previousStock,
          newStock,
          change: newStock - previousStock,
          reason,
          backend: product.shopId ? "shopify" : "native",
        };
        await recordAudit({
          orgId,
          actor: "agent:inventory",
          toolName: "inventory__update_stock",
          target: `product:${productId}`,
          args: { productId, newStock, reason },
          result,
        });
        return result;
      } catch (e) {
        await recordAudit({
          orgId,
          actor: "agent:inventory",
          toolName: "inventory__update_stock",
          target: `product:${productId}`,
          args: { productId, newStock, reason },
          status: "error",
          error: (e as Error).message,
        });
        return { error: (e as Error).message };
      }
    },
  }),

  inventory__forecast_demand: tool({
    description:
      "Forecast future demand and stock depletion dates based on sales history",
    inputSchema: z.object({
      productId: z.number().optional().describe("Specific product, or omit for top products"),
      forecastDays: z.number().default(30),
    }),
    execute: async ({ productId, forecastDays }) => {
      const condition = productId
        ? sql`AND oi.product_id = ${productId}`
        : sql``;

      const result = await db.execute(sql`
        WITH weekly_sales AS (
          SELECT
            oi.product_id,
            p.name,
            p.stock,
            date_trunc('week', o.created_at) AS week,
            SUM(oi.quantity) AS units
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN products p ON p.id = oi.product_id
          WHERE o.created_at >= NOW() - INTERVAL '60 days'
            AND o.status NOT IN ('cancelled', 'refunded')
            ${condition}
          GROUP BY oi.product_id, p.name, p.stock, date_trunc('week', o.created_at)
        ),
        product_stats AS (
          SELECT
            product_id, name, stock,
            AVG(units) AS avg_weekly_sales,
            STDDEV(units) AS stddev_weekly_sales,
            MAX(units) AS peak_weekly_sales
          FROM weekly_sales
          GROUP BY product_id, name, stock
        )
        SELECT *,
          CASE
            WHEN avg_weekly_sales > 0
            THEN ROUND(stock / avg_weekly_sales * 7, 1)
            ELSE NULL
          END AS est_days_until_stockout,
          ROUND(avg_weekly_sales / 7 * ${forecastDays}, 0) AS forecasted_demand
        FROM product_stats
        ORDER BY est_days_until_stockout ASC NULLS LAST
        LIMIT 15
      `);

      return {
        forecastWindow: `${forecastDays} days`,
        products: result.rows,
      };
    },
  }),
};

// Push an absolute inventory quantity to Shopify. Implementation note:
// Shopify's v2 model is variant → inventory_item → inventory_level at a
// location. We resolve the variant's inventory_item and the shop's
// primary location, then call inventorySetQuantities (as of 2025-01 API).
async function updateShopifyInventory(
  shopId: string,
  productGid: string,
  quantity: number
): Promise<void> {
  const ctx = await adminContext(shopId);
  type VariantLookup = {
    product: {
      variants: {
        edges: Array<{
          node: { id: string; inventoryItem: { id: string } };
        }>;
      };
    } | null;
    locations: { edges: Array<{ node: { id: string } }> };
  };
  const data = await adminGraphql<VariantLookup>(
    ctx,
    `query V($gid: ID!) {
      product(id: $gid) {
        variants(first: 1) { edges { node { id inventoryItem { id } } } }
      }
      locations(first: 1) { edges { node { id } } }
    }`,
    { gid: productGid }
  );
  const invItemId = data.product?.variants.edges[0]?.node.inventoryItem.id;
  const locationId = data.locations.edges[0]?.node.id;
  if (!invItemId || !locationId) {
    throw new Error("could not resolve inventory item or location");
  }
  await adminGraphql(
    ctx,
    `mutation Set($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        name: "available",
        reason: "correction",
        ignoreCompareQuantity: true,
        quantities: [{ inventoryItemId: invItemId, locationId, quantity }],
      },
    }
  );
}
