import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { products, orders, orderItems, analyticsEvents, customers } from "@/lib/db/schema";
import { sql, eq, desc, and, gte, lte, count, sum } from "drizzle-orm";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const marketingTools = {
  marketing__generate_campaign: tool({
    description:
      "Create a full marketing campaign plan based on store data and goals",
    inputSchema: z.object({
      goal: z
        .enum([
          "increase_sales",
          "clear_inventory",
          "launch_product",
          "seasonal_sale",
          "win_back_customers",
          "boost_aov",
        ])
        .describe("Campaign goal"),
      budget: z.number().optional().describe("Budget in USD"),
      duration: z.string().default("2 weeks").describe("Campaign duration"),
      targetCategory: z.string().optional(),
    }),
    execute: async ({ goal, budget, duration, targetCategory }) => {
      // Gather store context for the campaign
      const [revenueData] = await db
        .select({
          avgOrderValue: sql<string>`ROUND(AVG(total::numeric), 2)`,
          totalCustomers: count(sql`DISTINCT customer_id`),
        })
        .from(orders)
        .where(gte(orders.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));

      let categoryContext = "";
      if (targetCategory) {
        const [catData] = await db
          .select({
            productCount: count(),
            avgPrice: sql<string>`ROUND(AVG(price::numeric), 2)`,
          })
          .from(products)
          .where(eq(products.category, targetCategory));
        categoryContext = `Target Category: ${targetCategory} (${catData.productCount} products, avg price $${catData.avgPrice})`;
      }

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Create a detailed marketing campaign plan for an e-commerce store.

Goal: ${goal.replace(/_/g, " ")}
Budget: ${budget ? `$${budget}` : "Flexible"}
Duration: ${duration}
${categoryContext}
Store Context:
- Average Order Value: $${revenueData.avgOrderValue}
- Active Customers (30d): ${revenueData.totalCustomers}

Create a campaign plan as JSON with:
- name: catchy campaign name
- channels: array of {channel, allocation_pct, tactics}
- timeline: array of {week, actions}
- expectedResults: {estimatedReach, estimatedConversions, estimatedRevenue}
- keyMessages: array of 3 marketing messages
- discountStrategy: {type, amount, conditions}

Return ONLY valid JSON.`,
      });

      try {
        return { goal, budget, duration, plan: JSON.parse(text) };
      } catch {
        return { goal, budget, duration, rawPlan: text };
      }
    },
  }),

  marketing__write_email_copy: tool({
    description: "Generate email marketing copy for a specific purpose",
    inputSchema: z.object({
      purpose: z
        .enum([
          "welcome",
          "abandoned_cart",
          "sale_announcement",
          "product_launch",
          "win_back",
          "thank_you",
          "newsletter",
        ])
        .describe("Email purpose"),
      productIds: z
        .array(z.number())
        .optional()
        .describe("Product IDs to feature"),
      discountCode: z.string().optional(),
    }),
    execute: async ({ purpose, productIds, discountCode }) => {
      let productContext = "";
      if (productIds && productIds.length > 0) {
        const prods = await db
          .select({
            name: products.name,
            price: products.price,
            description: products.description,
            category: products.category,
          })
          .from(products)
          .where(sql`${products.id} IN ${productIds}`);
        productContext = `Featured Products:\n${prods.map((p) => `- ${p.name} ($${p.price}): ${p.description?.slice(0, 100)}`).join("\n")}`;
      }

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Write email marketing copy for an e-commerce store.

Purpose: ${purpose.replace(/_/g, " ")}
${productContext}
${discountCode ? `Discount Code: ${discountCode}` : ""}

Return JSON with:
- subjectLine: compelling subject line (max 50 chars)
- previewText: email preview text (max 90 chars)
- heading: main heading
- body: email body (HTML-safe, 2-3 short paragraphs)
- ctaText: call-to-action button text
- ctaUrl: suggested CTA URL path

Return ONLY valid JSON.`,
      });

      try {
        return { purpose, email: JSON.parse(text) };
      } catch {
        return { purpose, rawEmail: text };
      }
    },
  }),

  marketing__discount_strategy: tool({
    description:
      "Analyze margins and sales patterns to recommend discount strategies",
    inputSchema: z.object({
      goal: z.enum(["maximize_revenue", "clear_inventory", "acquire_customers"]),
      maxDiscountPct: z.number().default(30),
    }),
    execute: async ({ goal, maxDiscountPct }) => {
      // Get products with margin data
      const result = await db.execute(sql`
        WITH product_sales AS (
          SELECT
            p.id, p.name, p.category, p.price::numeric, p.cost_per_item::numeric AS cost,
            p.stock, p.compare_at_price::numeric,
            COALESCE(SUM(oi.quantity), 0) AS units_sold_30d
          FROM products p
          LEFT JOIN order_items oi ON oi.product_id = p.id
          LEFT JOIN orders o ON o.id = oi.order_id
            AND o.created_at >= NOW() - INTERVAL '30 days'
            AND o.status NOT IN ('cancelled', 'refunded')
          WHERE p.status = 'active' AND p.cost_per_item IS NOT NULL
          GROUP BY p.id, p.name, p.category, p.price, p.cost_per_item, p.stock, p.compare_at_price
        )
        SELECT *,
          ROUND((price - cost) / price * 100, 1) AS margin_pct,
          ROUND(LEAST(
            GREATEST((price - cost) / price * 100 - 15, 0),
            ${maxDiscountPct}
          ), 0) AS max_safe_discount
        FROM product_sales
        ORDER BY
          CASE
            WHEN '${sql.raw(goal)}' = 'clear_inventory' THEN stock
            WHEN '${sql.raw(goal)}' = 'maximize_revenue' THEN units_sold_30d
            ELSE margin_pct
          END DESC
        LIMIT 15
      `);

      const strategies = {
        maximize_revenue: "Discount best-sellers slightly to drive volume",
        clear_inventory: "Deeper discounts on slow-moving, high-stock items",
        acquire_customers: "Loss-leader pricing on entry-level products",
      };

      return {
        goal,
        strategy: strategies[goal],
        maxDiscountPct,
        products: result.rows,
      };
    },
  }),

  marketing__social_media_posts: tool({
    description:
      "Generate social media post copy for products across platforms",
    inputSchema: z.object({
      productId: z.number(),
      platforms: z
        .array(z.enum(["instagram", "twitter", "facebook", "tiktok"]))
        .default(["instagram", "twitter"]),
    }),
    execute: async ({ productId, platforms }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return { error: `Product ${productId} not found` };

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Create social media posts for this product across platforms.

Product: ${product.name}
Price: $${product.price}
Category: ${product.category}
Description: ${product.description}
Tags: ${(product.tags as string[])?.join(", ")}

Platforms: ${platforms.join(", ")}

Return JSON with an object per platform:
{
  "platform_name": {
    "post": "post text with emojis",
    "hashtags": ["relevant", "hashtags"],
    "bestTimeToPost": "suggested posting time",
    "contentType": "reel/story/post/carousel"
  }
}

Return ONLY valid JSON.`,
      });

      try {
        return { product: product.name, posts: JSON.parse(text) };
      } catch {
        return { product: product.name, rawPosts: text };
      }
    },
  }),
};
