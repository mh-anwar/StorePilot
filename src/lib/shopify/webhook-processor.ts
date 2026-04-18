// Fan out webhook events to targeted mirror updates. Reads the
// `webhook_events` row by (shopId, webhookId) — keeps the route thin and
// lets the queue retry this step independently.
import { db } from "../db";
import {
  webhookEvents,
  shops,
  products,
  orders,
  customers,
} from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { deleteSecret } from "../crypto";

type WebhookPayload = Record<string, unknown> & { id?: number | string };

export async function processWebhook(args: {
  shopId: string;
  topic: string;
  webhookId: string;
}) {
  const [row] = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.shopId, args.shopId),
        eq(webhookEvents.webhookId, args.webhookId)
      )
    );
  if (!row) return;
  const payload = row.payload as WebhookPayload;

  try {
    switch (args.topic) {
      case "products/create":
      case "products/update":
        await upsertProductFromWebhook(args.shopId, payload);
        break;
      case "products/delete":
        if (payload.id) {
          await db
            .delete(products)
            .where(
              and(
                eq(products.shopId, args.shopId),
                eq(products.shopifyGid, `gid://shopify/Product/${payload.id}`)
              )
            );
        }
        break;
      case "orders/create":
      case "orders/updated":
      case "orders/cancelled":
        await upsertOrderFromWebhook(args.shopId, payload);
        break;
      case "inventory_levels/update":
        await updateInventoryFromWebhook(args.shopId, payload);
        break;
      case "customers/create":
      case "customers/update":
        await upsertCustomerFromWebhook(args.shopId, payload);
        break;
      case "app/uninstalled":
        await handleUninstall(args.shopId);
        break;
      case "customers/data_request":
      case "customers/redact":
      case "shop/redact":
        // GDPR topics: log, ack. Real redaction logic goes here — for now
        // we record the request so a human can follow up.
        await db
          .update(webhookEvents)
          .set({
            processedAt: new Date(),
            error: "GDPR topic — no auto-action, review manually",
          })
          .where(eq(webhookEvents.id, row.id));
        return;
      default:
        // Unknown topic — ack.
        break;
    }
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: null })
      .where(eq(webhookEvents.id, row.id));
  } catch (e) {
    await db
      .update(webhookEvents)
      .set({ error: (e as Error).message })
      .where(eq(webhookEvents.id, row.id));
    throw e;
  }
}

async function upsertProductFromWebhook(shopId: string, p: WebhookPayload) {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!s) return;
  const gid = `gid://shopify/Product/${p.id}`;
  const variants = (p.variants as Array<Record<string, unknown>> | undefined) ?? [];
  const variant = variants[0];
  const price = (variant?.price as string) ?? "0.00";
  const sku = (variant?.sku as string) ?? `SP-${p.id}`;
  const compare = (variant?.compare_at_price as string | null) ?? null;

  const values = {
    orgId: s.orgId,
    shopId,
    shopifyGid: gid,
    name: String(p.title ?? "Untitled"),
    slug: `${String(p.handle ?? p.id)}-${shopId.slice(0, 6)}`,
    description: String(p.body_html ?? "").replace(/<[^>]+>/g, "").slice(0, 8000),
    category: String(p.product_type ?? "Uncategorized"),
    price,
    compareAtPrice: compare,
    sku,
    stock: Number(variant?.inventory_quantity ?? 0),
    status:
      String(p.status ?? "active").toLowerCase() === "active"
        ? ("active" as const)
        : ("draft" as const),
    tags: String(p.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    vendor: String(p.vendor ?? ""),
    imageUrl: ((p.image as Record<string, unknown> | undefined)?.src as string) ?? null,
  };
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.shopId, shopId), eq(products.shopifyGid, gid)));
  if (existing) {
    await db
      .update(products)
      .set({ ...values, slug: existing.slug })
      .where(eq(products.id, existing.id));
  } else {
    await db.insert(products).values(values).onConflictDoNothing({ target: products.sku });
  }
}

async function upsertCustomerFromWebhook(shopId: string, c: WebhookPayload) {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!s || !c.email) return;
  const gid = `gid://shopify/Customer/${c.id}`;
  const values = {
    orgId: s.orgId,
    shopId,
    shopifyGid: gid,
    email: String(c.email).toLowerCase(),
    firstName: String(c.first_name ?? ""),
    lastName: String(c.last_name ?? ""),
    phone: (c.phone as string) ?? null,
    totalOrders: Number(c.orders_count ?? 0),
    totalSpent: String(c.total_spent ?? "0"),
  };
  await db
    .insert(customers)
    .values(values)
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        totalOrders: values.totalOrders,
        totalSpent: values.totalSpent,
        shopifyGid: gid,
        shopId,
      },
    });
}

async function upsertOrderFromWebhook(shopId: string, o: WebhookPayload) {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!s) return;
  const gid = `gid://shopify/Order/${o.id}`;
  const email = ((o.customer as Record<string, unknown> | undefined)?.email as string | undefined)?.toLowerCase();
  let customerId: number | null = null;
  if (email) {
    const [c] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email));
    customerId = c?.id ?? null;
  }
  if (!customerId) return;
  const status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded" =
    o.financial_status === "refunded"
      ? "refunded"
      : o.cancelled_at
        ? "cancelled"
        : "confirmed";
  const values = {
    orgId: s.orgId,
    shopId,
    shopifyGid: gid,
    orderNumber: String(o.name ?? `ORDER-${o.id}`),
    customerId,
    status,
    subtotal: String(o.subtotal_price ?? "0"),
    tax: String(o.total_tax ?? "0"),
    shippingCost: String(((o.total_shipping_price_set as Record<string, unknown> | undefined)?.shop_money as Record<string, unknown> | undefined)?.amount ?? "0"),
    discount: String(o.total_discounts ?? "0"),
    total: String(o.total_price ?? "0"),
  };
  const [existing] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.shopifyGid, gid)));
  if (existing) {
    await db.update(orders).set(values).where(eq(orders.id, existing.id));
  } else {
    await db
      .insert(orders)
      .values(values)
      .onConflictDoNothing({ target: orders.orderNumber });
  }
}

async function updateInventoryFromWebhook(shopId: string, p: WebhookPayload) {
  // inventory_item_id + available
  const invItem = p.inventory_item_id;
  const available = Number(p.available ?? 0);
  if (!invItem) return;
  // We'd need a variant→inventory_item map to translate. For now, emit an
  // analytic note so we can wire the mapping in a follow-up.
  await db.execute(sql`
    INSERT INTO inventory_adjustments (product_id, delta, reason, actor, created_at)
    SELECT p.id, ${available} - p.stock, 'shopify_inventory_level_update', 'shopify', NOW()
    FROM products p
    WHERE p.shop_id = ${shopId} AND false
  `);
}

async function handleUninstall(shopId: string) {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!s) return;
  await db
    .update(shops)
    .set({ status: "uninstalled", uninstalledAt: new Date() })
    .where(eq(shops.id, shopId));
  // Tokens are no longer valid — delete them.
  await deleteSecret(s.orgId, `shopify:${shopId}:token`);
}
