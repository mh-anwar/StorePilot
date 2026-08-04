// Turns Admin API responses (and REST-shaped webhook payloads) into the
// domain types in ../disputes/types. Pure functions: no I/O, easy to test.

import {
  DISPUTE_REASONS,
  DISPUTE_STATUSES,
  type Address,
  type DisputeReason,
  type DisputeStatus,
  type OrderSnapshot,
  type RemoteDispute,
} from "../disputes/types";

type Maybe<T> = T | null | undefined;

export interface RawMoney {
  amount: string;
  currencyCode?: string;
}

export interface RawDispute {
  id: string;
  type: string;
  status: string;
  initiatedAt: string;
  evidenceDueBy: Maybe<string>;
  evidenceSentOn: Maybe<string>;
  finalizedOn: Maybe<string>;
  amount: RawMoney;
  reasonDetails: { reason: string; networkReasonCode: Maybe<string> };
  order: Maybe<{ id: string; name: string }>;
  disputeEvidence: Maybe<{ id: string; submitted?: boolean }>;
}

interface RawAddress {
  name?: Maybe<string>;
  address1?: Maybe<string>;
  address2?: Maybe<string>;
  city?: Maybe<string>;
  province?: Maybe<string>;
  zip?: Maybe<string>;
  country?: Maybe<string>;
  countryCodeV2?: Maybe<string>;
}

export interface RawOrder {
  id: string;
  name: string;
  createdAt: string;
  sourceName: Maybe<string>;
  tags: Maybe<string[]>;
  clientIp: Maybe<string>;
  totalPriceSet: { shopMoney: RawMoney };
  customer: Maybe<{
    id: string;
    firstName: Maybe<string>;
    lastName: Maybe<string>;
    email: Maybe<string>;
    createdAt: Maybe<string>;
    numberOfOrders: Maybe<string | number>;
    amountSpent: Maybe<RawMoney>;
  }>;
  billingAddress: Maybe<RawAddress>;
  shippingAddress: Maybe<RawAddress>;
  lineItems: {
    nodes: Array<{
      title: string;
      variantTitle: Maybe<string>;
      sku: Maybe<string>;
      quantity: number;
      requiresShipping: Maybe<boolean>;
      originalUnitPriceSet: Maybe<{ shopMoney: RawMoney }>;
    }>;
  };
  transactions: Array<{
    kind: string;
    status: string;
    gateway: Maybe<string>;
    paymentDetails: Maybe<{
      company?: Maybe<string>;
      number?: Maybe<string>;
      avsResultCode?: Maybe<string>;
      cvvResultCode?: Maybe<string>;
    }>;
  }>;
  fulfillments: Array<{
    status: string;
    displayStatus: Maybe<string>;
    createdAt: string;
    deliveredAt: Maybe<string>;
    trackingInfo: Array<{ company: Maybe<string>; number: Maybe<string>; url: Maybe<string> }>;
  }>;
  refunds: Array<{
    createdAt: string;
    note: Maybe<string>;
    totalRefundedSet: { shopMoney: RawMoney };
  }>;
}

export interface RawShop {
  name: string;
  email: Maybe<string>;
  currencyCode: string;
  shopPolicies: Array<{ type: string; body: string }>;
}

/** "12.50" -> 1250. Avoids float drift by splitting on the decimal point. */
export function toCents(amount: Maybe<string | number>): number {
  if (amount === null || amount === undefined || amount === "") return 0;
  const s = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace(/^-/, "").split(".");
  const cents = parseInt(whole || "0", 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return negative ? -cents : cents;
}

export function asReason(value: Maybe<string>): DisputeReason {
  const upper = (value ?? "").toUpperCase() as DisputeReason;
  return DISPUTE_REASONS.includes(upper) ? upper : "GENERAL";
}

export function asStatus(value: Maybe<string>): DisputeStatus {
  const upper = (value ?? "").toUpperCase() as DisputeStatus;
  return DISPUTE_STATUSES.includes(upper) ? upper : "NEEDS_RESPONSE";
}

export function normalizeDispute(raw: RawDispute): RemoteDispute {
  return {
    id: raw.id,
    evidenceId: raw.disputeEvidence?.id ?? null,
    type: raw.type?.toUpperCase() === "INQUIRY" ? "INQUIRY" : "CHARGEBACK",
    status: asStatus(raw.status),
    reason: asReason(raw.reasonDetails?.reason),
    networkReasonCode: raw.reasonDetails?.networkReasonCode ?? null,
    amountCents: toCents(raw.amount?.amount),
    currencyCode: raw.amount?.currencyCode ?? "USD",
    initiatedAt: raw.initiatedAt,
    evidenceDueBy: raw.evidenceDueBy ?? null,
    evidenceSentOn: raw.evidenceSentOn ?? null,
    finalizedOn: raw.finalizedOn ?? null,
    order: raw.order ? { id: raw.order.id, name: raw.order.name } : null,
  };
}

/**
 * disputes/create and disputes/update webhooks use the REST resource shape.
 * We keep only what we need to upsert the row; the full record (with the
 * evidence id) is fetched from GraphQL right after.
 */
export interface DisputeWebhookPayload {
  id: number | string;
  admin_graphql_api_id?: string;
  order_id?: number | string | null;
  type?: string;
  amount?: string;
  currency?: string;
  reason?: string;
  network_reason_code?: string | null;
  status?: string;
  evidence_due_by?: string | null;
  evidence_sent_on?: string | null;
  finalized_on?: string | null;
  initiated_at?: string;
}

export function disputeFromWebhook(payload: DisputeWebhookPayload): RemoteDispute {
  const orderId = payload.order_id ? `gid://shopify/Order/${payload.order_id}` : null;
  return {
    id: payload.admin_graphql_api_id ?? `gid://shopify/ShopifyPaymentsDispute/${payload.id}`,
    evidenceId: null,
    type: payload.type?.toUpperCase() === "INQUIRY" ? "INQUIRY" : "CHARGEBACK",
    status: asStatus(payload.status),
    reason: asReason(payload.reason),
    networkReasonCode: payload.network_reason_code ?? null,
    amountCents: toCents(payload.amount),
    currencyCode: payload.currency ?? "USD",
    initiatedAt: payload.initiated_at ?? new Date().toISOString(),
    evidenceDueBy: payload.evidence_due_by ?? null,
    evidenceSentOn: payload.evidence_sent_on ?? null,
    finalizedOn: payload.finalized_on ?? null,
    order: orderId ? { id: orderId, name: "" } : null,
  };
}

function address(raw: Maybe<RawAddress>): Address | null {
  if (!raw) return null;
  return {
    name: raw.name ?? null,
    address1: raw.address1 ?? null,
    address2: raw.address2 ?? null,
    city: raw.city ?? null,
    province: raw.province ?? null,
    zip: raw.zip ?? null,
    country: raw.country ?? null,
    countryCode: raw.countryCodeV2 ?? null,
  };
}

export function policiesFromShop(shop: Maybe<RawShop>): OrderSnapshot["policies"] {
  const find = (type: string) =>
    shop?.shopPolicies.find((p) => p.type === type)?.body?.trim() || null;
  return {
    refund: find("REFUND_POLICY"),
    shipping: find("SHIPPING_POLICY"),
    terms: find("TERMS_OF_SERVICE"),
  };
}

export function normalizeOrder(
  raw: RawOrder,
  policies: OrderSnapshot["policies"],
): OrderSnapshot {
  // The payment that was disputed is the successful sale/capture. Fall back to
  // any card transaction so AVS/CVV still show up for authorize-only flows.
  const paid =
    raw.transactions.find(
      (t) => ["SALE", "CAPTURE"].includes(t.kind) && t.status === "SUCCESS",
    ) ??
    raw.transactions.find((t) => t.paymentDetails?.avsResultCode || t.paymentDetails?.cvvResultCode) ??
    raw.transactions[0];
  const details = paid?.paymentDetails ?? null;
  const last4 = details?.number ? details.number.replace(/\D/g, "").slice(-4) || null : null;

  return {
    orderId: raw.id,
    orderName: raw.name,
    createdAt: raw.createdAt,
    totalCents: toCents(raw.totalPriceSet.shopMoney.amount),
    currencyCode: raw.totalPriceSet.shopMoney.currencyCode ?? "USD",
    sourceName: raw.sourceName ?? null,
    tags: raw.tags ?? [],
    customer: raw.customer
      ? {
          id: raw.customer.id,
          firstName: raw.customer.firstName ?? null,
          lastName: raw.customer.lastName ?? null,
          email: raw.customer.email ?? null,
          ordersCount: Number(raw.customer.numberOfOrders ?? 0),
          totalSpentCents: toCents(raw.customer.amountSpent?.amount),
          createdAt: raw.customer.createdAt ?? null,
        }
      : null,
    billingAddress: address(raw.billingAddress),
    shippingAddress: address(raw.shippingAddress),
    lineItems: raw.lineItems.nodes.map((li) => ({
      title: li.title,
      variantTitle: li.variantTitle ?? null,
      sku: li.sku ?? null,
      quantity: li.quantity,
      unitPriceCents: toCents(li.originalUnitPriceSet?.shopMoney.amount),
      requiresShipping: li.requiresShipping ?? true,
    })),
    payment: {
      gateway: paid?.gateway ?? null,
      cardBrand: details?.company ?? null,
      last4,
      avsResultCode: details?.avsResultCode ?? null,
      cvvResultCode: details?.cvvResultCode ?? null,
      browserIp: raw.clientIp ?? null,
    },
    fulfillments: raw.fulfillments.map((f) => {
      const tracking = f.trackingInfo[0];
      return {
        status: f.status,
        displayStatus: f.displayStatus ?? null,
        createdAt: f.createdAt,
        deliveredAt: f.deliveredAt ?? null,
        trackingCompany: tracking?.company ?? null,
        trackingNumber: tracking?.number ?? null,
        trackingUrl: tracking?.url ?? null,
      };
    }),
    refunds: raw.refunds.map((r) => ({
      createdAt: r.createdAt,
      amountCents: toCents(r.totalRefundedSet.shopMoney.amount),
      note: r.note ?? null,
    })),
    policies,
  };
}
