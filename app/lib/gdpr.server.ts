// Mandatory privacy webhooks. Customer PII only ever lives inside a dispute's
// evidence pack (the order snapshot) and its drafts, so that's what we export
// or scrub. Requests are recorded without the customer's contact details.

import type { Dispute } from "@prisma/client";
import prisma from "../db.server";
import { logActivity } from "./context.server";
import { draftView, snapshotOf } from "./disputes/records.server";
import type { OrderSnapshot } from "./disputes/types";

export type ComplianceTopic = "CUSTOMERS_DATA_REQUEST" | "CUSTOMERS_REDACT" | "SHOP_REDACT";

interface CustomerPayload {
  shop_domain?: string;
  customer?: { id?: number | string; email?: string; phone?: string };
  orders_requested?: Array<number | string>;
  orders_to_redact?: Array<number | string>;
  data_request?: { id?: number | string };
}

const orderGid = (id: number | string) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/Order/${id}`);
const customerGid = (id: number | string) =>
  String(id).startsWith("gid://") ? String(id) : `gid://shopify/Customer/${id}`;

/** What we keep about the request itself: ids only, never email/phone. */
function strippedPayload(payload: CustomerPayload) {
  return JSON.stringify({
    customerId: payload.customer?.id ?? null,
    orders: payload.orders_requested ?? payload.orders_to_redact ?? [],
    dataRequestId: payload.data_request?.id ?? null,
  });
}

async function disputesForCustomer(shopDomain: string, payload: CustomerPayload): Promise<Dispute[]> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return [];
  const orders = (payload.orders_requested ?? payload.orders_to_redact ?? []).map(orderGid);
  const customer = payload.customer?.id != null ? customerGid(payload.customer.id) : null;
  const or: object[] = [];
  if (customer) or.push({ customerId: customer });
  if (orders.length) or.push({ orderId: { in: orders } });
  if (!or.length) return [];
  return prisma.dispute.findMany({ where: { shopId: shop.id, OR: or } });
}

export async function handleDataRequest(shopDomain: string, payload: CustomerPayload) {
  const disputes = await disputesForCustomer(shopDomain, payload);
  const drafts = await prisma.evidenceDraft.findMany({
    where: { disputeId: { in: disputes.map((d) => d.id) } },
    orderBy: { version: "asc" },
  });
  const exportData = disputes.map((d) => ({
    dispute: d.shopifyId,
    order: d.orderName ?? d.orderId,
    reason: d.reason,
    status: d.status,
    evidencePack: snapshotOf(d),
    responses: drafts.filter((x) => x.disputeId === d.id).map((x) => draftView(x).fields),
  }));
  const request = await prisma.gdprRequest.create({
    data: {
      shopDomain,
      topic: "customers/data_request",
      customerId: payload.customer?.id != null ? String(payload.customer.id) : null,
      payload: strippedPayload(payload),
      status: "completed",
      result: JSON.stringify({ disputes: exportData.length, data: exportData }),
      completedAt: new Date(),
    },
  });
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (shop) {
    await logActivity(
      shop.id,
      "gdpr",
      `Customer data request received: ${exportData.length} dispute${exportData.length === 1 ? "" : "s"} hold their data. Export is in Settings → Privacy requests.`,
    );
  }
  return request;
}

/** Removes the customer's personal data from an order snapshot, keeping the facts about the order. */
export function scrubSnapshot(s: OrderSnapshot): OrderSnapshot {
  return {
    ...s,
    customer: s.customer
      ? { ...s.customer, firstName: null, lastName: null, email: null }
      : null,
    billingAddress: null,
    shippingAddress: null,
    payment: { ...s.payment, browserIp: null },
  };
}

export async function handleCustomerRedact(shopDomain: string, payload: CustomerPayload) {
  const disputes = await disputesForCustomer(shopDomain, payload);
  const now = new Date();
  for (const d of disputes) {
    const snapshot = snapshotOf(d);
    await prisma.dispute.update({
      where: { id: d.id },
      data: {
        snapshot: snapshot ? JSON.stringify(scrubSnapshot(snapshot)) : null,
        redactedAt: now,
      },
    });
    // Drafts are free text that quote names and addresses: drop their content.
    await prisma.evidenceDraft.updateMany({
      where: { disputeId: d.id },
      data: { fields: JSON.stringify({ _notes: ["Content erased on the customer's request."] }) },
    });
  }
  await prisma.gdprRequest.create({
    data: {
      shopDomain,
      topic: "customers/redact",
      customerId: payload.customer?.id != null ? String(payload.customer.id) : null,
      payload: strippedPayload(payload),
      status: "completed",
      result: JSON.stringify({ disputesRedacted: disputes.length }),
      completedAt: now,
    },
  });
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (shop && disputes.length) {
    await logActivity(shop.id, "gdpr", `Erased a customer's data from ${disputes.length} evidence pack${disputes.length === 1 ? "" : "s"} on their request.`);
  }
  return disputes.length;
}

/** 48 hours after uninstall Shopify asks us to forget the shop entirely. */
export async function handleShopRedact(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  let disputes = 0;
  if (shop) {
    disputes = await prisma.dispute.count({ where: { shopId: shop.id } });
    await prisma.shop.delete({ where: { id: shop.id } }); // cascades
  }
  await prisma.session.deleteMany({ where: { shop: shopDomain } });
  await prisma.gdprRequest.deleteMany({ where: { shopDomain } });
  await prisma.gdprRequest.create({
    data: {
      shopDomain,
      topic: "shop/redact",
      payload: "{}",
      status: "completed",
      result: JSON.stringify({ shopDeleted: Boolean(shop), disputesDeleted: disputes }),
      completedAt: new Date(),
    },
  });
  return { shopDeleted: Boolean(shop), disputes };
}

export async function handleCompliance(topic: string, shopDomain: string, payload: unknown) {
  const p = (payload ?? {}) as CustomerPayload;
  switch (topic.toUpperCase().replace("/", "_")) {
    case "CUSTOMERS_DATA_REQUEST":
      return handleDataRequest(shopDomain, p);
    case "CUSTOMERS_REDACT":
      return handleCustomerRedact(shopDomain, p);
    case "SHOP_REDACT":
      return handleShopRedact(shopDomain);
    default:
      throw new Error(`Unhandled compliance topic ${topic}`);
  }
}

export async function privacyRequests(shopDomain: string) {
  const rows = await prisma.gdprRequest.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    hasExport: r.topic === "customers/data_request",
  }));
}
