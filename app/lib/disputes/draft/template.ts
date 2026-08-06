// Deterministic evidence writer. Used on the Free plan, when no Anthropic key
// is configured, and as the fallback when the model call fails. It fills the
// same fields the AI drafter does, from the same facts, in plain sentences.

import { avsMatch, cvvMatch, formatDate, formatMoney, reasonLabel } from "../evidence";
import type { Assessment, EvidenceFields, OrderSnapshot, RemoteDispute } from "../types";

export const FIELD_LIMIT = 2000;
export const LETTER_LIMIT = 4500;

export function clip(text: string, limit = FIELD_LIMIT): string {
  const t = text.trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
}

export interface DraftContext {
  dispute: RemoteDispute;
  snapshot: OrderSnapshot;
  assessment: Assessment;
  shopName: string;
  supportEmail?: string | null;
}

function lineItemsSentence(s: OrderSnapshot): string {
  return s.lineItems
    .map((li) => `${li.quantity} × ${li.title}${li.variantTitle ? ` (${li.variantTitle})` : ""}`)
    .join(", ");
}

function deliverySentence(s: OrderSnapshot): string | null {
  const shipped = s.fulfillments.filter((f) => f.status !== "CANCELLED");
  if (!shipped.length) return null;
  const f = shipped.find((x) => x.displayStatus === "DELIVERED" || x.deliveredAt) ?? shipped[0];
  const where = s.shippingAddress
    ? ` to ${[s.shippingAddress.address1, s.shippingAddress.city, s.shippingAddress.zip].filter(Boolean).join(", ")}`
    : "";
  const tracking = f.trackingNumber
    ? ` via ${f.trackingCompany ?? "the carrier"} (tracking ${f.trackingNumber})`
    : "";
  if (f.displayStatus === "DELIVERED" || f.deliveredAt) {
    return `The order shipped on ${formatDate(f.createdAt)}${tracking} and was delivered${where} on ${formatDate(f.deliveredAt ?? f.createdAt)}.`;
  }
  return `The order shipped on ${formatDate(f.createdAt)}${tracking}${where}.`;
}

export function accessActivityLog(s: OrderSnapshot): string {
  const lines: string[] = [];
  lines.push(`Order ${s.orderName} placed ${formatDate(s.createdAt)} through ${s.sourceName ?? "the online store"}.`);
  if (s.payment.browserIp) lines.push(`Purchase IP address: ${s.payment.browserIp}.`);
  const avs = avsMatch(s.payment.avsResultCode);
  if (avs !== "unknown") {
    lines.push(
      `AVS result ${s.payment.avsResultCode}: ${avs === "full" ? "street address and postal code matched" : avs === "partial" ? "partial address match" : "no match"}.`,
    );
  }
  const cvv = cvvMatch(s.payment.cvvResultCode);
  if (cvv !== "unknown") lines.push(`CVV result ${s.payment.cvvResultCode}: ${cvv === "match" ? "matched" : "did not match"}.`);
  if (s.payment.cardBrand || s.payment.last4) {
    lines.push(`Card: ${s.payment.cardBrand ?? "card"} ending ${s.payment.last4 ?? "????"}.`);
  }
  if (s.customer && s.customer.ordersCount > 1) {
    lines.push(
      `The customer account has ${s.customer.ordersCount} orders since ${formatDate(s.customer.createdAt)}, totalling ${formatMoney(s.customer.totalSpentCents, s.currencyCode)}.`,
    );
  }
  return lines.join("\n");
}

function letter(ctx: DraftContext): string {
  const { dispute: d, snapshot: s, assessment: a, shopName } = ctx;
  const p: string[] = [];
  const who = [s.customer?.firstName, s.customer?.lastName].filter(Boolean).join(" ") || "the cardholder";

  p.push(
    `${shopName} disputes this ${reasonLabel(d.reason)} chargeback of ${formatMoney(d.amountCents, d.currencyCode)} on order ${s.orderName}, placed by ${who} on ${formatDate(s.createdAt)} for ${lineItemsSentence(s)}.`,
  );

  const delivery = deliverySentence(s);
  const refunded = s.refunds.reduce((sum, r) => sum + r.amountCents, 0);

  switch (d.reason) {
    case "PRODUCT_NOT_RECEIVED":
      if (delivery) p.push(delivery);
      p.push("The carrier's tracking record is the delivery evidence; we ask that the dispute be resolved in our favour.");
      break;
    case "FRAUDULENT":
    case "UNRECOGNIZED":
    case "DEBIT_NOT_AUTHORIZED": {
      const facts: string[] = [];
      if (avsMatch(s.payment.avsResultCode) === "full") facts.push("the issuer verified the billing address");
      if (cvvMatch(s.payment.cvvResultCode) === "match") facts.push("the correct security code was entered");
      if (s.customer && s.customer.ordersCount > 1) {
        facts.push(`the same customer account has placed ${s.customer.ordersCount - 1} other order(s) without dispute`);
      }
      if (facts.length) p.push(`The purchase was authorized by the cardholder: ${facts.join("; ")}.`);
      if (delivery) p.push(delivery);
      break;
    }
    case "PRODUCT_UNACCEPTABLE":
      if (delivery) p.push(delivery);
      p.push(
        "The items matched their product listing. Our refund policy, shown at checkout, explains how to request a return; the customer did not follow it before disputing the charge.",
      );
      break;
    case "CREDIT_NOT_PROCESSED":
      if (refunded > 0) {
        p.push(
          `A refund of ${formatMoney(refunded, s.currencyCode)} was issued on ${formatDate(s.refunds[s.refunds.length - 1]?.createdAt)}. Refunds can take 5-10 business days to appear on a statement.`,
        );
      } else {
        p.push("No refund was owed under the store's refund policy, which the customer accepted at checkout.");
      }
      break;
    case "SUBSCRIPTION_CANCELLED":
      p.push("The charge was made before any cancellation request, in line with the terms the customer accepted at checkout.");
      if (delivery) p.push(delivery);
      break;
    case "DUPLICATE":
      p.push(`Order ${s.orderName} was charged once. Any other charge from ${shopName} is for a separate order.`);
      if (delivery) p.push(delivery);
      break;
    default:
      if (delivery) p.push(delivery);
  }

  const strongPoints = a.checklist.filter((i) => i.status === "strong").map((i) => `- ${i.detail}`);
  if (strongPoints.length) p.push(`Supporting evidence:\n${strongPoints.join("\n")}`);
  if (ctx.supportEmail) p.push(`Questions about this response can be sent to ${ctx.supportEmail}.`);

  return clip(p.join("\n\n"), LETTER_LIMIT);
}

export function draftFromTemplate(ctx: DraftContext): EvidenceFields {
  const { dispute: d, snapshot: s } = ctx;
  const fields: EvidenceFields = {};

  if (s.customer?.firstName) fields.customerFirstName = s.customer.firstName;
  if (s.customer?.lastName) fields.customerLastName = s.customer.lastName;
  if (s.customer?.email) fields.customerEmailAddress = s.customer.email;
  if (s.shippingAddress && s.lineItems.some((li) => li.requiresShipping)) {
    fields.shippingAddress = s.shippingAddress;
  }

  const fraudLike = ["FRAUDULENT", "UNRECOGNIZED", "DEBIT_NOT_AUTHORIZED", "GENERAL"].includes(d.reason);
  if (fraudLike) fields.accessActivityLog = clip(accessActivityLog(s));

  if (s.policies.refund && ["PRODUCT_UNACCEPTABLE", "CREDIT_NOT_PROCESSED", "GENERAL", "SUBSCRIPTION_CANCELLED"].includes(d.reason)) {
    fields.refundPolicyDisclosure = clip(
      `Our refund policy is published on the store and linked at checkout:\n\n${s.policies.refund}`,
    );
  }
  if (d.reason === "PRODUCT_UNACCEPTABLE" || d.reason === "CREDIT_NOT_PROCESSED") {
    const refunded = s.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    fields.refundRefusalExplanation = clip(
      refunded > 0
        ? `A refund of ${formatMoney(refunded, s.currencyCode)} has already been issued for this order.`
        : "The customer did not request a return or refund through the process in our refund policy before opening this dispute, so no refund was due.",
    );
  }
  if (d.reason === "SUBSCRIPTION_CANCELLED") {
    if (s.policies.terms) {
      fields.cancellationPolicyDisclosure = clip(
        `Our cancellation terms, accepted at checkout:\n\n${s.policies.terms}`,
      );
    }
    fields.cancellationRebuttal = clip(
      "We have no record of a cancellation request before this charge. The charge followed the billing schedule the customer agreed to.",
    );
  }

  fields.uncategorizedText = letter(ctx);
  return fields;
}
