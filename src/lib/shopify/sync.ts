// Initial + incremental sync jobs. Each job pulls a page of data from the
// Admin API, upserts into our mirror tables scoped by org_id + shop_id,
// then enqueues the next page until the cursor runs out.
import { adminContext, adminGraphql } from "./admin";
import { db } from "../db";
import { products, customers, orders, shops } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { enqueueProductSync, enqueueCustomerSync, enqueueOrderSync } from "../queue";
import { nanoid } from "nanoid";

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type Edge<T> = { cursor: string; node: T };

export async function syncProducts({ shopId, cursor }: { shopId: string; cursor?: string }) {
  const ctx = await adminContext(shopId);
  type ProductNode = {
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string | null;
    productType: string | null;
    vendor: string | null;
    status: "ACTIVE" | "ARCHIVED" | "DRAFT";
    tags: string[];
    featuredImage: { url: string } | null;
    variants: {
      edges: Edge<{
        id: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
        inventoryQuantity: number | null;
      }>[];
    };
  };
  const data = await adminGraphql<{
    products: { edges: Edge<ProductNode>[]; pageInfo: PageInfo };
  }>(
    ctx,
    `query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        edges { cursor node {
          id title handle descriptionHtml productType vendor status tags
          featuredImage { url }
          variants(first: 1) { edges { node { id sku price compareAtPrice inventoryQuantity } } }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { cursor: cursor ?? null }
  );

  for (const edge of data.products.edges) {
    const p = edge.node;
    const variant = p.variants.edges[0]?.node;
    const price = variant?.price ?? "0.00";
    const sku = variant?.sku ?? `SP-${p.id.split("/").pop()}`;
    const stock = variant?.inventoryQuantity ?? 0;

    const [existing] = await db
      .select()
      .from(products)
      .where(
        and(eq(products.shopId, shopId), eq(products.shopifyGid, p.id))
      );
    const baseValues = {
      orgId: ctx.orgId,
      shopId,
      shopifyGid: p.id,
      name: p.title,
      slug: p.handle + "-" + shopId.slice(0, 6),
      description: stripHtml(p.descriptionHtml ?? ""),
      category: p.productType || "Uncategorized",
      price,
      compareAtPrice: variant?.compareAtPrice ?? null,
      sku,
      stock,
      status: p.status === "ACTIVE" ? ("active" as const) : ("draft" as const),
      tags: p.tags,
      vendor: p.vendor,
      imageUrl: p.featuredImage?.url ?? null,
    };
    if (existing) {
      await db
        .update(products)
        .set({ ...baseValues, slug: existing.slug })
        .where(eq(products.id, existing.id));
    } else {
      await db
        .insert(products)
        .values(baseValues)
        .onConflictDoNothing({ target: products.sku });
    }
  }

  if (data.products.pageInfo.hasNextPage && data.products.pageInfo.endCursor) {
    await enqueueProductSync({ shopId, cursor: data.products.pageInfo.endCursor });
  } else {
    await db
      .update(shops)
      .set({ lastSyncedAt: new Date() })
      .where(eq(shops.id, shopId));
  }
}

export async function syncCustomers({ shopId, cursor }: { shopId: string; cursor?: string }) {
  const ctx = await adminContext(shopId);
  type CustomerNode = {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    numberOfOrders: string;
    amountSpent: { amount: string };
    defaultAddress: { city: string | null; province: string | null; countryCodeV2: string | null } | null;
    tags: string[];
  };
  const data = await adminGraphql<{
    customers: { edges: Edge<CustomerNode>[]; pageInfo: PageInfo };
  }>(
    ctx,
    `query Customers($cursor: String) {
      customers(first: 50, after: $cursor) {
        edges { cursor node {
          id email firstName lastName phone numberOfOrders
          amountSpent { amount }
          defaultAddress { city province countryCodeV2 }
          tags
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { cursor: cursor ?? null }
  );

  for (const edge of data.customers.edges) {
    const c = edge.node;
    if (!c.email) continue;
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, c.email.toLowerCase()));
    const baseValues = {
      orgId: ctx.orgId,
      shopId,
      shopifyGid: c.id,
      email: c.email.toLowerCase(),
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
      phone: c.phone ?? null,
      city: c.defaultAddress?.city ?? null,
      state: c.defaultAddress?.province ?? null,
      country: c.defaultAddress?.countryCodeV2 ?? "US",
      totalOrders: Number(c.numberOfOrders ?? 0),
      totalSpent: c.amountSpent?.amount ?? "0",
      tags: c.tags,
    };
    if (existing) {
      await db.update(customers).set(baseValues).where(eq(customers.id, existing.id));
    } else {
      await db.insert(customers).values(baseValues).onConflictDoNothing();
    }
  }

  if (data.customers.pageInfo.hasNextPage && data.customers.pageInfo.endCursor) {
    await enqueueCustomerSync({ shopId, cursor: data.customers.pageInfo.endCursor });
  }
}

export async function syncOrders({ shopId, cursor }: { shopId: string; cursor?: string }) {
  const ctx = await adminContext(shopId);
  type OrderNode = {
    id: string;
    name: string;
    displayFinancialStatus: string | null;
    displayFulfillmentStatus: string | null;
    subtotalPriceSet: { shopMoney: { amount: string } };
    totalTaxSet: { shopMoney: { amount: string } };
    totalShippingPriceSet: { shopMoney: { amount: string } };
    totalDiscountsSet: { shopMoney: { amount: string } };
    totalPriceSet: { shopMoney: { amount: string } };
    customer: { id: string; email: string | null } | null;
    createdAt: string;
    updatedAt: string;
    shippingAddress: {
      address1: string | null;
      address2: string | null;
      city: string | null;
      province: string | null;
      zip: string | null;
      countryCodeV2: string | null;
    } | null;
  };
  const data = await adminGraphql<{
    orders: { edges: Edge<OrderNode>[]; pageInfo: PageInfo };
  }>(
    ctx,
    `query Orders($cursor: String) {
      orders(first: 50, after: $cursor, sortKey: CREATED_AT) {
        edges { cursor node {
          id name displayFinancialStatus displayFulfillmentStatus
          subtotalPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          customer { id email }
          createdAt updatedAt
          shippingAddress { address1 address2 city province zip countryCodeV2 }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { cursor: cursor ?? null }
  );

  for (const edge of data.orders.edges) {
    const o = edge.node;
    // Resolve customer: must exist in mirror (synced first).
    let customerId: number | null = null;
    if (o.customer?.email) {
      const [c] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, o.customer.email.toLowerCase()));
      customerId = c?.id ?? null;
    }
    if (!customerId) {
      // Skip orders without a mirrored customer; re-runs pick them up.
      continue;
    }

    const [existing] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.shopifyGid, o.id)));
    const values = {
      orgId: ctx.orgId,
      shopId,
      shopifyGid: o.id,
      orderNumber: o.name || `ORDER-${o.id.split("/").pop()}`,
      customerId,
      status: mapOrderStatus(o.displayFinancialStatus, o.displayFulfillmentStatus),
      subtotal: o.subtotalPriceSet.shopMoney.amount,
      tax: o.totalTaxSet.shopMoney.amount,
      shippingCost: o.totalShippingPriceSet.shopMoney.amount,
      discount: o.totalDiscountsSet.shopMoney.amount,
      total: o.totalPriceSet.shopMoney.amount,
      shippingAddress: o.shippingAddress
        ? {
            line1: o.shippingAddress.address1 ?? "",
            line2: o.shippingAddress.address2 ?? "",
            city: o.shippingAddress.city ?? "",
            state: o.shippingAddress.province ?? "",
            zip: o.shippingAddress.zip ?? "",
            country: o.shippingAddress.countryCodeV2 ?? "US",
          }
        : null,
      createdAt: new Date(o.createdAt),
      updatedAt: new Date(o.updatedAt),
    };
    if (existing) {
      await db.update(orders).set(values).where(eq(orders.id, existing.id));
    } else {
      await db
        .insert(orders)
        .values(values)
        .onConflictDoNothing({ target: orders.orderNumber });
    }
  }

  if (data.orders.pageInfo.hasNextPage && data.orders.pageInfo.endCursor) {
    await enqueueOrderSync({ shopId, cursor: data.orders.pageInfo.endCursor });
  }
}

function mapOrderStatus(
  fin: string | null,
  ful: string | null
): "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded" {
  if (fin?.toLowerCase() === "refunded") return "refunded";
  if (fin?.toLowerCase() === "voided") return "cancelled";
  if (ful?.toLowerCase() === "fulfilled") return "delivered";
  if (ful?.toLowerCase() === "in_transit") return "shipped";
  if (fin?.toLowerCase() === "paid") return "confirmed";
  return "pending";
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 8000);
}
