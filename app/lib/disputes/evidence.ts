// Scores an evidence pack for the dispute's reason code and recommends
// fight / accept / review. Pure and deterministic: the AI drafter writes the
// words, but whether a dispute is worth fighting is decided here, where a
// merchant (and a test) can read exactly why.

import type {
  Address,
  Assessment,
  DisputeReason,
  EvidenceItem,
  OrderSnapshot,
  Recommendation,
  RemoteDispute,
} from "./types";

// Card networks' AVS codes, grouped. Codes differ slightly by network; these
// are the ones Shopify Payments surfaces.
const AVS_FULL = new Set(["Y", "X", "D", "F", "M"]);
const AVS_PARTIAL = new Set(["A", "B", "P", "W", "Z"]);
const AVS_NONE = new Set(["N", "C"]);

export type AvsMatch = "full" | "partial" | "none" | "unknown";
export type CvvMatch = "match" | "no_match" | "unknown";

export function avsMatch(code: string | null | undefined): AvsMatch {
  const c = (code ?? "").trim().toUpperCase();
  if (AVS_FULL.has(c)) return "full";
  if (AVS_PARTIAL.has(c)) return "partial";
  if (AVS_NONE.has(c)) return "none";
  return "unknown";
}

export function cvvMatch(code: string | null | undefined): CvvMatch {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "M") return "match";
  if (c === "N") return "no_match";
  return "unknown";
}

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function sameAddress(a: Address | null, b: Address | null): boolean {
  if (!a || !b) return false;
  return (
    norm(a.address1) !== "" &&
    norm(a.address1) === norm(b.address1) &&
    norm(a.zip) === norm(b.zip) &&
    norm(a.countryCode ?? a.country) === norm(b.countryCode ?? b.country)
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const strong = (key: string, label: string, detail: string, weight: number): EvidenceItem => ({
  key,
  label,
  status: "strong",
  detail,
  weight,
});
const weak = (key: string, label: string, detail: string, weight: number): EvidenceItem => ({
  key,
  label,
  status: "weak",
  detail,
  weight,
});
const missing = (key: string, label: string, detail: string, weight: number): EvidenceItem => ({
  key,
  label,
  status: "missing",
  detail,
  weight,
});

// --- individual checks -------------------------------------------------------

function deliveryCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Delivery confirmation";
  const shipped = s.fulfillments.filter((f) => f.status !== "CANCELLED");
  const delivered = shipped.find((f) => f.displayStatus === "DELIVERED" || f.deliveredAt);
  if (delivered) {
    const carrier = delivered.trackingCompany ?? "The carrier";
    return strong(
      "delivery",
      label,
      `${carrier} shows the order delivered on ${formatDate(delivered.deliveredAt ?? delivered.createdAt)}.`,
      weight,
    );
  }
  if (shipped.some((f) => f.trackingNumber)) {
    return weak("delivery", label, "Shipped with tracking, but the carrier has not confirmed delivery.", weight);
  }
  if (shipped.length) {
    return weak("delivery", label, "Marked fulfilled without a tracking number.", weight);
  }
  return missing("delivery", label, "The order was never fulfilled.", weight);
}

function trackingCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Tracking number";
  const tracked = s.fulfillments.find((f) => f.trackingNumber);
  if (tracked) {
    return strong(
      "tracking",
      label,
      `${tracked.trackingCompany ?? "Carrier"} tracking ${tracked.trackingNumber}.`,
      weight,
    );
  }
  return missing("tracking", label, "No tracking number on any fulfillment.", weight);
}

function shippingMatchesBilling(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Shipped to the billing address";
  if (!s.lineItems.some((li) => li.requiresShipping)) {
    return weak("address_match", label, "Digital or non-shipping order; no address to compare.", weight);
  }
  if (sameAddress(s.shippingAddress, s.billingAddress)) {
    return strong("address_match", label, "Shipping and billing addresses are the same.", weight);
  }
  return weak("address_match", label, "Shipping address differs from the billing address.", weight);
}

function avsCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Address verification (AVS)";
  const code = s.payment.avsResultCode;
  switch (avsMatch(code)) {
    case "full":
      return strong("avs", label, `The card issuer matched the billing street and postal code (AVS ${code}).`, weight);
    case "partial":
      return weak("avs", label, `The issuer matched part of the billing address (AVS ${code}).`, weight);
    case "none":
      return missing("avs", label, `The billing address did not match the card (AVS ${code}).`, weight);
    default:
      return missing("avs", label, "No AVS result on the payment.", weight);
  }
}

function cvvCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Security code (CVV)";
  const code = s.payment.cvvResultCode;
  switch (cvvMatch(code)) {
    case "match":
      return strong("cvv", label, "The card's security code was entered correctly.", weight);
    case "no_match":
      return missing("cvv", label, "The security code did not match.", weight);
    default:
      return missing("cvv", label, "No CVV result on the payment.", weight);
  }
}

function customerHistoryCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Customer history";
  const c = s.customer;
  if (!c) return missing("history", label, "Guest checkout with no customer record.", weight);
  const prior = Math.max(0, c.ordersCount - 1);
  if (prior >= 2) {
    return strong(
      "history",
      label,
      `Returning customer with ${prior} earlier orders (${formatMoney(c.totalSpentCents, s.currencyCode)} lifetime).`,
      weight,
    );
  }
  if (prior === 1) return weak("history", label, "One earlier order from this customer.", weight);
  return missing("history", label, "First order from this customer.", weight);
}

function ipCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "Purchase IP address";
  if (s.payment.browserIp) {
    return weak("ip", label, `Order placed from IP ${s.payment.browserIp}.`, weight);
  }
  return missing("ip", label, "No browser IP recorded (POS or draft order).", weight);
}

function policyCheck(
  key: "refund_policy" | "shipping_policy" | "terms",
  text: string | null,
  weight: number,
): EvidenceItem {
  const labels = {
    refund_policy: "Refund policy",
    shipping_policy: "Shipping policy",
    terms: "Terms of service / cancellation policy",
  } as const;
  if (text && text.length >= 80) {
    return strong(key, labels[key], "Published on the store and shown at checkout.", weight);
  }
  if (text) return weak(key, labels[key], "Published, but very short.", weight);
  return missing(key, labels[key], "Not published in Shopify settings.", weight);
}

function refundCheck(s: OrderSnapshot, d: RemoteDispute, weight: number): EvidenceItem {
  const label = "Refund issued";
  const refunded = s.refunds.reduce((sum, r) => sum + r.amountCents, 0);
  if (refunded >= d.amountCents && refunded > 0) {
    return strong(
      "refund",
      label,
      `Refunded ${formatMoney(refunded, s.currencyCode)} on ${formatDate(s.refunds[s.refunds.length - 1]?.createdAt)}.`,
      weight,
    );
  }
  if (refunded > 0) {
    return weak("refund", label, `Partially refunded (${formatMoney(refunded, s.currencyCode)}).`, weight);
  }
  return missing("refund", label, "No refund has been issued.", weight);
}

function productDescriptionCheck(s: OrderSnapshot, weight: number): EvidenceItem {
  const label = "What was sold";
  if (s.lineItems.length && s.lineItems.every((li) => li.sku || li.variantTitle)) {
    return strong("product", label, `${s.lineItems.length} line item(s) with SKU or variant detail.`, weight);
  }
  if (s.lineItems.length) return weak("product", label, "Line items have no SKU or variant detail.", weight);
  return missing("product", label, "No line items on the order.", weight);
}

// --- checklists per reason ---------------------------------------------------

export function checklistFor(d: RemoteDispute, s: OrderSnapshot): EvidenceItem[] {
  switch (d.reason) {
    case "PRODUCT_NOT_RECEIVED":
      return [
        deliveryCheck(s, 40),
        trackingCheck(s, 20),
        shippingMatchesBilling(s, 15),
        customerHistoryCheck(s, 10),
        policyCheck("shipping_policy", s.policies.shipping, 15),
      ];
    case "FRAUDULENT":
    case "UNRECOGNIZED":
    case "DEBIT_NOT_AUTHORIZED":
      return [
        avsCheck(s, 25),
        cvvCheck(s, 20),
        deliveryCheck(s, 20),
        shippingMatchesBilling(s, 10),
        customerHistoryCheck(s, 15),
        ipCheck(s, 10),
      ];
    case "PRODUCT_UNACCEPTABLE":
      return [
        policyCheck("refund_policy", s.policies.refund, 30),
        productDescriptionCheck(s, 20),
        deliveryCheck(s, 25),
        customerHistoryCheck(s, 10),
        trackingCheck(s, 15),
      ];
    case "CREDIT_NOT_PROCESSED":
      return [
        refundCheck(s, d, 50),
        policyCheck("refund_policy", s.policies.refund, 35),
        deliveryCheck(s, 15),
      ];
    case "SUBSCRIPTION_CANCELLED":
      return [
        policyCheck("terms", s.policies.terms, 40),
        policyCheck("refund_policy", s.policies.refund, 20),
        customerHistoryCheck(s, 20),
        deliveryCheck(s, 20),
      ];
    case "DUPLICATE":
      return [
        productDescriptionCheck(s, 30),
        deliveryCheck(s, 30),
        refundCheck(s, d, 20),
        customerHistoryCheck(s, 20),
      ];
    default:
      return [
        deliveryCheck(s, 30),
        avsCheck(s, 15),
        cvvCheck(s, 10),
        customerHistoryCheck(s, 15),
        policyCheck("refund_policy", s.policies.refund, 15),
        productDescriptionCheck(s, 15),
      ];
  }
}

export function scoreChecklist(items: EvidenceItem[]): number {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  if (!total) return 0;
  const earned = items.reduce(
    (sum, i) => sum + (i.status === "strong" ? i.weight : i.status === "weak" ? i.weight * 0.4 : 0),
    0,
  );
  return Math.round((earned / total) * 100);
}

export const FIGHT_THRESHOLD = 65;
export const ACCEPT_THRESHOLD = 35;

export interface AssessOptions {
  /** Below this amount, only clearly winnable disputes are worth the merchant's time. */
  minFightAmountCents?: number;
  now?: Date;
}

const REASON_LABEL: Record<DisputeReason, string> = {
  BANK_CANNOT_PROCESS: "bank cannot process",
  CREDIT_NOT_PROCESSED: "credit not processed",
  CUSTOMER_INITIATED: "customer initiated",
  DEBIT_NOT_AUTHORIZED: "debit not authorized",
  DUPLICATE: "duplicate charge",
  FRAUDULENT: "fraudulent",
  GENERAL: "general",
  INCORRECT_ACCOUNT_DETAILS: "incorrect account details",
  INSUFFICIENT_FUNDS: "insufficient funds",
  PRODUCT_NOT_RECEIVED: "product not received",
  PRODUCT_UNACCEPTABLE: "product unacceptable",
  SUBSCRIPTION_CANCELLED: "subscription cancelled",
  UNRECOGNIZED: "unrecognized charge",
};

export function reasonLabel(reason: DisputeReason): string {
  return REASON_LABEL[reason] ?? reason.toLowerCase().replace(/_/g, " ");
}

export function assess(
  d: RemoteDispute,
  s: OrderSnapshot,
  opts: AssessOptions = {},
): Assessment {
  const checklist = checklistFor(d, s);
  const score = scoreChecklist(checklist);
  const reasons: string[] = [];
  let recommendation: Recommendation;

  const strongItems = checklist.filter((i) => i.status === "strong");
  const missingItems = checklist.filter((i) => i.status === "missing");
  const now = opts.now ?? new Date();
  const pastDue = d.evidenceDueBy ? new Date(d.evidenceDueBy) < now : false;
  const refunded = s.refunds.reduce((sum, r) => sum + r.amountCents, 0);

  if (d.reason === "CREDIT_NOT_PROCESSED" && refunded >= d.amountCents && refunded > 0) {
    recommendation = "FIGHT";
    reasons.push("You already refunded this order, which is exactly what the cardholder says didn't happen.");
  } else if (score >= FIGHT_THRESHOLD) {
    recommendation = "FIGHT";
    reasons.push(`Evidence is strong for a "${reasonLabel(d.reason)}" dispute (${score}/100).`);
  } else if (score < ACCEPT_THRESHOLD) {
    recommendation = "ACCEPT";
    reasons.push(`Evidence is thin for a "${reasonLabel(d.reason)}" dispute (${score}/100); banks rarely reverse these without it.`);
  } else {
    recommendation = "REVIEW";
    reasons.push(`Evidence is mixed (${score}/100). Worth fighting if you can add something we couldn't see, like customer emails.`);
  }

  if (
    recommendation !== "ACCEPT" &&
    opts.minFightAmountCents &&
    d.amountCents < opts.minFightAmountCents &&
    score < FIGHT_THRESHOLD + 15
  ) {
    recommendation = "ACCEPT";
    reasons.push(
      `At ${formatMoney(d.amountCents, d.currencyCode)} it is under your ${formatMoney(opts.minFightAmountCents, d.currencyCode)} minimum, and the case isn't a clear win.`,
    );
  }

  if (d.type === "INQUIRY" && recommendation === "ACCEPT") {
    recommendation = "REVIEW";
    reasons.push("This is an inquiry, not a chargeback yet. Answering is free and can stop it from escalating.");
  }

  if (strongItems.length) {
    reasons.push(`Strongest points: ${strongItems.map((i) => i.label.toLowerCase()).join(", ")}.`);
  }
  if (missingItems.length && recommendation !== "ACCEPT") {
    reasons.push(`Missing: ${missingItems.map((i) => i.label.toLowerCase()).join(", ")}.`);
  }
  if (pastDue) {
    reasons.push("The evidence deadline has passed; Shopify will no longer accept a response.");
  }

  return { score, recommendation, reasons, checklist };
}
