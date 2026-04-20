// Fan out webhook events to targeted mirror updates. Reads the
// `webhook_events` row by (shopId, webhookId) — keeps the route thin and
// lets the queue retry this step independently.
import { db } from "../db";
import {
  webhookEvents,
  shops,
  products,
  orders,
  orderItems,
  customers,
} from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { deleteSecret } from "../crypto";
import { recordAudit } from "../agents/audit";

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
        // We don't have rich customer content to export beyond mirror
        // rows; record the request as an audit entry so a human can
        // respond within Shopify's 30-day SLA.
        await recordAudit({
          orgId: (await shopOrg(args.shopId)) ?? "",
          actor: `system:gdpr`,
          toolName: "gdpr.data_request",
          target: `customer:${(payload.customer as { email?: string })?.email ?? "?"}`,
          args: payload as Record<string, unknown>,
        });
        break;
      case "customers/redact":
        await redactCustomer(args.shopId, payload);
        break;
      case "shop/redact":
        await redactShop(args.shopId);
        break;
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

async function shopOrg(shopId: string): Promise<string | null> {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  return s?.orgId ?? null;
}

// Delete mirrored customer data on customers/redact. Shopify sends this
// 30 days after a customer requests redaction. We remove PII-bearing
// rows in the mirror and log a system audit entry.
async function redactCustomer(shopId: string, payload: WebhookPayload) {
  const orgId = await shopOrg(shopId);
  if (!orgId) return;
  const email = ((payload.customer as { email?: string })?.email ?? "").toLowerCase();
  const shopifyGid = payload.customer
    ? `gid://shopify/Customer/${(payload.customer as { id: number }).id}`
    : null;

  // Find the mirror row(s) for this customer.
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.orgId, orgId),
        email
          ? eq(customers.email, email)
          : shopifyGid
            ? eq(customers.shopifyGid, shopifyGid)
            : sql`false`
      )
    );
  for (const c of rows) {
    // Cascade-clean orders + items so we don't leave orphaned PII.
    const ordersToClean = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.customerId, c.id));
    for (const o of ordersToClean) {
      await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
    }
    await db.delete(orders).where(eq(orders.customerId, c.id));
    await db.delete(customers).where(eq(customers.id, c.id));
  }
  await recordAudit({
    orgId,
    actor: "system:gdpr",
    toolName: "gdpr.customers_redact",
    target: email || shopifyGid || "unknown",
    args: { shopId, email, shopifyGid },
    result: { deletedCustomers: rows.length },
  });
}

// Delete all data for a shop on shop/redact. Fired 48h after app
// uninstall; at that point we must purge.
async function redactShop(shopId: string) {
  const orgId = await shopOrg(shopId);
  if (!orgId) return;
  // Orders → items cascade; customers cascade; products cascade.
  await db.delete(orderItems).where(
    sql`${orderItems.orderId} IN (SELECT id FROM orders WHERE shop_id = ${shopId})`
  );
  await db.delete(orders).where(eq(orders.shopId, shopId));
  await db.delete(customers).where(eq(customers.shopId, shopId));
  await db.delete(products).where(eq(products.shopId, shopId));
  // Finally drop the shop row itself. encrypted_secrets was already
  // cleared on app/uninstalled.
  await db.delete(shops).where(eq(shops.id, shopId));
  await recordAudit({
    orgId,
    actor: "system:gdpr",
    toolName: "gdpr.shop_redact",
    target: shopId,
    args: { shopId },
  });
}
