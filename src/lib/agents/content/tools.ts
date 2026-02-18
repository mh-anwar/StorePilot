import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const contentTools = {
  content__generate_description: tool({
    description:
      "Generate an optimized product description for a given product. Reads current product data and creates compelling copy.",
    inputSchema: z.object({
      productId: z.number().describe("Product ID to generate description for"),
      tone: z
        .enum(["professional", "casual", "luxurious", "playful", "technical"])
        .default("professional"),
      length: z
        .enum(["short", "medium", "long"])
        .default("medium")
        .describe("short=1-2 sentences, medium=paragraph, long=multiple paragraphs"),
    }),
    execute: async ({ productId, tone, length }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return { error: `Product ${productId} not found` };

      const lengthGuide =
        length === "short"
          ? "1-2 sentences"
          : length === "medium"
            ? "one compelling paragraph (3-5 sentences)"
            : "2-3 detailed paragraphs";

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Write a ${tone} product description for an e-commerce listing.

Product: ${product.name}
Category: ${product.category}
Current Description: ${product.description || "None"}
Price: $${product.price}
Tags: ${(product.tags as string[])?.join(", ") || "None"}
Vendor: ${product.vendor || "Unknown"}

Requirements:
- Tone: ${tone}
- Length: ${lengthGuide}
- Include key selling points and benefits
- Use sensory language where appropriate
- End with a subtle call to action
- Do NOT include the price in the description

Return ONLY the description text, no headers or labels.`,
      });

      return {
        productId,
        productName: product.name,
        currentDescription: product.description,
        generatedDescription: text,
        tone,
        length,
      };
    },
  }),

  content__optimize_seo: tool({
    description:
      "Analyze and optimize SEO title and meta description for a product",
    inputSchema: z.object({
      productId: z.number(),
    }),
    execute: async ({ productId }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return { error: `Product ${productId} not found` };

      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Optimize the SEO for this e-commerce product listing.

Product: ${product.name}
Category: ${product.category}
Description: ${product.description || "None"}
Current SEO Title: ${product.seoTitle || "None"}
Current SEO Description: ${product.seoDescription || "None"}
Price: $${product.price}
Tags: ${(product.tags as string[])?.join(", ") || "None"}

Return a JSON object with:
- seoTitle: optimized title (max 60 characters, include primary keyword)
- seoDescription: optimized meta description (max 155 characters, include CTA)
- keywords: array of 5-8 target keywords
- improvements: array of specific suggestions made

Return ONLY valid JSON, no markdown.`,
      });

      try {
        const parsed = JSON.parse(text);
        return {
          productId,
          productName: product.name,
          current: {
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
          },
          optimized: parsed,
        };
      } catch {
        return {
          productId,
          productName: product.name,
          rawSuggestion: text,
        };
      }
    },
  }),

  content__bulk_improve_listings: tool({
    description:
      "Scan products in a category and identify listings that need improvement (missing descriptions, weak SEO, etc.)",
    inputSchema: z.object({
      category: z.string().optional().describe("Filter by category, or omit for all"),
      limit: z.number().default(10),
    }),
    execute: async ({ category, limit }) => {
      const conditions = [];
      if (category) conditions.push(eq(products.category, category));

      const result = await db
        .select({
          id: products.id,
          name: products.name,
          category: products.category,
          description: products.description,
          seoTitle: products.seoTitle,
          seoDescription: products.seoDescription,
          tags: products.tags,
        })
        .from(products)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .limit(limit);

      const issues = result.map((p) => {
        const problems: string[] = [];
        if (!p.description || p.description.length < 50)
          problems.push("Description too short or missing");
        if (!p.seoTitle || p.seoTitle.length > 60)
          problems.push("SEO title missing or too long");
        if (!p.seoDescription || p.seoDescription.length > 160)
          problems.push("Meta description missing or too long");
        if (!(p.tags as string[])?.length)
          problems.push("No tags for discoverability");
        return {
          productId: p.id,
          productName: p.name,
          category: p.category,
          issueCount: problems.length,
          issues: problems,
        };
      });

      return {
        scanned: result.length,
        needsImprovement: issues.filter((i) => i.issueCount > 0).length,
        listings: issues.sort((a, b) => b.issueCount - a.issueCount),
      };
    },
  }),

  content__suggest_pricing: tool({
    description:
      "Analyze pricing for a product compared to category averages and margins",
    inputSchema: z.object({
      productId: z.number(),
    }),
    execute: async ({ productId }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return { error: `Product ${productId} not found` };

      const [categoryStats] = await db
        .select({
          avgPrice: sql<string>`ROUND(AVG(price::numeric), 2)`,
          minPrice: sql<string>`MIN(price::numeric)`,
          maxPrice: sql<string>`MAX(price::numeric)`,
          productCount: count(),
        })
        .from(products)
        .where(eq(products.category, product.category));

      const price = parseFloat(product.price);
      const cost = product.costPerItem
        ? parseFloat(product.costPerItem)
        : null;
      const margin = cost ? ((price - cost) / price) * 100 : null;
      const avgPrice = parseFloat(categoryStats.avgPrice);

      return {
        product: {
          id: product.id,
          name: product.name,
          currentPrice: product.price,
          costPerItem: product.costPerItem,
          compareAtPrice: product.compareAtPrice,
          margin: margin ? `${margin.toFixed(1)}%` : "Unknown (no cost data)",
        },
        categoryAnalysis: {
          category: product.category,
          ...categoryStats,
          pricePosition:
            price > avgPrice * 1.2
              ? "Premium (above average)"
              : price < avgPrice * 0.8
                ? "Budget (below average)"
                : "Competitive (near average)",
        },
        suggestions: [
          margin && margin < 30
            ? "Low margin — consider price increase or cost reduction"
            : null,
          product.compareAtPrice
            ? `Compare-at price set at $${product.compareAtPrice} (${(((parseFloat(product.compareAtPrice) - price) / parseFloat(product.compareAtPrice)) * 100).toFixed(0)}% off)`
            : "No compare-at price — consider adding one for perceived value",
          price > avgPrice * 1.5
            ? "Significantly above category average — ensure premium positioning justifies price"
            : null,
        ].filter(Boolean),
      };
    },
  }),
};
