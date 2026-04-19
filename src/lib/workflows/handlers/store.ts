// Store-scoped action handlers. Each one writes to the merchant's store
// (via Shopify Admin API if connected, otherwise the native DB), records
// an audit row, and returns what was changed.
import { registerStep } from "../registry";
import { db } from "@/lib/db";
import {
  products,
  customers,
  discounts,
  inventoryAdjustments,
  orders,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { adminContext, adminGraphql } from "@/lib/shopify/admin";
import { recordAudit } from "@/lib/agents/audit";

registerStep("store.update_inventory", {
  category: "Store",
  description: "Set the on-hand stock quantity for a product. Routes to Shopify Admin API when the product is Shopify-backed, otherwise updates the native DB.",
  handler: async (_step, cfg, ctx) => {
    const productId = Number(cfg.productId);
    const newStock = Number(cfg.quantity);
    const reason = String(cfg.reason ?? "workflow adjustment");
    if (!productId || !Number.isFinite(newStock)) {
      return { status: "error", error: "productId + quantity are required" };
    }
    const [p] = await db
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
        shopId: products.shopId,
        shopifyGid: products.shopifyGid,
      })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.orgId, ctx.orgId)));
    if (!p) return { status: "error", error: `product ${productId} not found` };

    try {
      if (p.shopId && p.shopifyGid) {
        await updateShopifyInventory(p.shopId, p.shopifyGid, newStock);
      }
      await db
        .update(products)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(products.id, productId));
      await db.insert(inventoryAdjustments).values({
        productId,
        delta: newStock - p.stock,
        reason,
        actor: `workflow:${ctx.workflowId}`,
      });
      const out = {
        productId,
        productName: p.name,
        previousStock: p.stock,
        newStock,
        change: newStock - p.stock,
        backend: p.shopId ? "shopify" : "native",
      };
      await recordAudit({
        orgId: ctx.orgId,
        actor: `automation:${ctx.runId}` as never,
        toolName: "store.update_inventory",
        target: `product:${productId}`,
        args: cfg,
        result: out,
      });
      return { status: "ok", output: out };
    } catch (e) {
      return { status: "error", error: (e as Error).message };
    }
  },
});

registerStep("store.update_price", {
  category: "Store",
  description: "Set the price of a product (and optionally the compare-at price).",
  handler: async (_step, cfg, ctx) => {
    const productId = Number(cfg.productId);
    const price = cfg.price != null ? String(cfg.price) : undefined;
    const compareAt = cfg.compareAtPrice != null ? String(cfg.compareAtPrice) : undefined;
    if (!productId || !price) {
      return { status: "error", error: "productId + price required" };
    }
    const [p] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.orgId, ctx.orgId)));
    if (!p) return { status: "error", error: "not found" };

    if (p.shopId && p.shopifyGid) {
      await pushShopifyPrice(p.shopId, p.shopifyGid, price, compareAt);
    }
    await db
      .update(products)
      .set({
        price,
        ...(compareAt ? { compareAtPrice: compareAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
    const out = {
      productId,
      productName: p.name,
      previousPrice: p.price,
      newPrice: price,
    };
    await recordAudit({
      orgId: ctx.orgId,
      actor: `automation:${ctx.runId}` as never,
      toolName: "store.update_price",
      target: `product:${productId}`,
      args: cfg,
      result: out,
    });
    return { status: "ok", output: out };
  },
});

registerStep("store.create_discount", {
  category: "Store",
  description: "Create a discount code for the store.",
  handler: async (_step, cfg, ctx) => {
    const code = String(cfg.code ?? "").toUpperCase().trim();
    if (!code) return { status: "error", error: "code required" };
    const type = (cfg.type as "percentage" | "fixed_amount" | "free_shipping") ?? "percentage";
    const value = String(cfg.value ?? "0");
    try {
      const [d] = await db
        .insert(discounts)
        .values({
          orgId: ctx.orgId,
          code,
          type,
          value,
          description: (cfg.description as string) ?? null,
          minSubtotal: (cfg.minSubtotal as string) ?? null,
          usageLimit: (cfg.usageLimit as number) ?? null,
          active: true,
        })
        .returning();
      await recordAudit({
        orgId: ctx.orgId,
        actor: `automation:${ctx.runId}` as never,
        toolName: "store.create_discount",
        args: cfg,
        result: { id: d.id, code: d.code },
      });
      return { status: "ok", output: { id: d.id, code: d.code, value: d.value } };
    } catch (e) {
      return { status: "error", error: (e as Error).message };
    }
  },
});

registerStep("store.tag_customer", {
  category: "Store",
  description: "Add one or more tags to a customer.",
  handler: async (_step, cfg, ctx) => {
    const customerId = Number(cfg.customerId);
    const addTags = Array.isArray(cfg.tags) ? (cfg.tags as string[]) : [String(cfg.tag ?? "")];
    if (!customerId || addTags.length === 0) {
      return { status: "error", error: "customerId + tags required" };
    }
    const [c] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.orgId, ctx.orgId)));
    if (!c) return { status: "error", error: "customer not found" };
    const existing = (c.tags ?? []) as string[];
    const next = Array.from(new Set([...existing, ...addTags.filter(Boolean)]));
    await db.update(customers).set({ tags: next }).where(eq(customers.id, customerId));
    return {
      status: "ok",
      output: { customerId, tagsAdded: addTags, currentTags: next },
    };
  },
});

registerStep("store.fetch_order", {
  category: "Store",
  description: "Load a single order by id into the run context.",
  handler: async (_step, cfg, ctx) => {
    const id = Number(cfg.orderId);
    if (!id) return { status: "error", error: "orderId required" };
    const [o] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.orgId, ctx.orgId)));
    if (!o) return { status: "error", error: "order not found" };
    return { status: "ok", output: o };
  },
});

registerStep("store.low_stock_report", {
  category: "Store",
  description: "Emit a list of products at or below their low stock threshold.",
  handler: async (_step, cfg, ctx) => {
    const limit = Number(cfg.limit ?? 20);
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
        threshold: products.lowStockThreshold,
      })
      .from(products)
      .where(
        and(
          eq(products.orgId, ctx.orgId),
          sql`${products.stock} <= ${products.lowStockThreshold}`,
          eq(products.status, "active")
        )
      )
      .orderBy(products.stock)
      .limit(limit);
    return { status: "ok", output: { count: rows.length, products: rows } };
  },
});

async function updateShopifyInventory(shopId: string, productGid: string, quantity: number) {
  const ctx = await adminContext(shopId);
  const data = await adminGraphql<{
    product: { variants: { edges: Array<{ node: { inventoryItem: { id: string } } }> } } | null;
    locations: { edges: Array<{ node: { id: string } }> };
  }>(
    ctx,
    `query ($gid: ID!) {
      product(id: $gid) { variants(first: 1) { edges { node { inventoryItem { id } } } } }
      locations(first: 1) { edges { node { id } } }
    }`,
    { gid: productGid }
  );
  const invItemId = data.product?.variants.edges[0]?.node.inventoryItem.id;
  const locationId = data.locations.edges[0]?.node.id;
  if (!invItemId || !locationId) throw new Error("could not resolve inventory item/location");
  await adminGraphql(
    ctx,
    `mutation ($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { field message } }
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

async function pushShopifyPrice(
  shopId: string,
  productGid: string,
  price: string,
  compareAt?: string
) {
  const ctx = await adminContext(shopId);
  const data = await adminGraphql<{
    product: { variants: { edges: Array<{ node: { id: string } }> } } | null;
  }>(
    ctx,
    `query ($gid: ID!) { product(id: $gid) { variants(first: 1) { edges { node { id } } } } }`,
    { gid: productGid }
  );
  const variantId = data.product?.variants.edges[0]?.node.id;
  if (!variantId) throw new Error("variant not found");
  await adminGraphql(
    ctx,
    `mutation ($in: ProductVariantInput!) {
      productVariantUpdate(input: $in) { userErrors { field message } }
    }`,
    {
      in: {
        id: variantId,
        price,
        ...(compareAt ? { compareAtPrice: compareAt } : {}),
      },
    }
  );
}
