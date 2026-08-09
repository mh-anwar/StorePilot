import { expect, it } from "vitest";
import { asReason, asStatus, disputeFromWebhook, normalizeDispute, normalizeOrder, policiesFromShop, toCents, type RawOrder } from "../../app/lib/shopify/normalize";

it.each([["12.5", 1250], ["0.07", 7], ["-3.10", -310], [12.5, 1250], [null, 0], [undefined, 0], ["", 0], [" 12.50 ", 1250]] as const)("converts %s to cents", (input, expected) => expect(toCents(input)).toBe(expected));
it("normalizes reasons and statuses with safe fallbacks", () => {
  expect(asReason("fraudulent")).toBe("FRAUDULENT");
  expect(asStatus("won")).toBe("WON");
  for (const value of [null, undefined, "unknown", ""]) {
    expect(asReason(value)).toBe("GENERAL"); expect(asStatus(value)).toBe("NEEDS_RESPONSE");
  }
});
it("normalizes GraphQL disputes and nullable fields", () => {
  expect(normalizeDispute({ id: "dispute", type: "inquiry", status: "under_review", initiatedAt: "2026-07-10", evidenceDueBy: undefined, evidenceSentOn: null, finalizedOn: null, amount: { amount: "12.50", currencyCode: "CAD" }, reasonDetails: { reason: "fraudulent", networkReasonCode: "10.4" }, order: { id: "order", name: "#1001" }, disputeEvidence: { id: "evidence" } })).toEqual({ id: "dispute", evidenceId: "evidence", type: "INQUIRY", status: "UNDER_REVIEW", reason: "FRAUDULENT", networkReasonCode: "10.4", amountCents: 1250, currencyCode: "CAD", initiatedAt: "2026-07-10", evidenceDueBy: null, evidenceSentOn: null, finalizedOn: null, order: { id: "order", name: "#1001" } });
});
it("builds webhook GIDs and honors supplied GraphQL IDs", () => {
  expect(disputeFromWebhook({ id: 12, order_id: 34, amount: "12.50", type: "inquiry", reason: "fraudulent", status: "won", initiated_at: "2026-07-10" })).toMatchObject({ id: "gid://shopify/ShopifyPaymentsDispute/12", order: { id: "gid://shopify/Order/34", name: "" }, evidenceId: null, amountCents: 1250, type: "INQUIRY", reason: "FRAUDULENT", status: "WON", currencyCode: "USD", initiatedAt: "2026-07-10" });
  expect(disputeFromWebhook({ id: 12, admin_graphql_api_id: "custom" })).toMatchObject({ id: "custom", order: null, type: "CHARGEBACK", amountCents: 0 });
});
function rawOrder(): RawOrder {
  return { id: "order", name: "#1001", createdAt: "2026-07-01", sourceName: null, tags: null, clientIp: "192.0.2.1", totalPriceSet: { shopMoney: { amount: "125.00" } }, customer: { id: "customer", firstName: "Ada", lastName: null, email: null, createdAt: null, numberOfOrders: "4", amountSpent: { amount: "500.00" } }, billingAddress: null, shippingAddress: { address1: "10 King St", countryCodeV2: "CA" }, lineItems: { nodes: [{ title: "Bag", variantTitle: null, sku: "BAG", quantity: 1, requiresShipping: null, originalUnitPriceSet: { shopMoney: { amount: "125.00" } } }] }, transactions: [], fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-07-02", deliveredAt: "2026-07-05", trackingInfo: [{ company: "UPS", number: "FIRST", url: "https://example.com/first" }, { company: "Other", number: "SECOND", url: null }] }], refunds: [{ createdAt: "2026-07-06", note: "Return", totalRefundedSet: { shopMoney: { amount: "25.50" } } }] };
}
it.each(["SALE", "CAPTURE"])("selects successful %s over failed and authorization transactions", kind => {
  const raw = rawOrder();
  raw.transactions = [{ kind: "SALE", status: "FAILURE", gateway: "failed", paymentDetails: null }, { kind: "AUTHORIZATION", status: "SUCCESS", gateway: "auth", paymentDetails: { avsResultCode: "N" } }, { kind, status: "SUCCESS", gateway: "shopify_payments", paymentDetails: { company: "Visa", number: "•••• •••• •••• 4242", avsResultCode: "Y", cvvResultCode: "M" } }];
  const policies = { refund: "Refund policy", shipping: null, terms: null };
  expect(normalizeOrder(raw, policies)).toMatchObject({ totalCents: 12500, currencyCode: "USD", tags: [], customer: { ordersCount: 4, totalSpentCents: 50000 }, shippingAddress: { countryCode: "CA" }, lineItems: [{ unitPriceCents: 12500, requiresShipping: true }], payment: { gateway: "shopify_payments", last4: "4242", avsResultCode: "Y", cvvResultCode: "M" }, fulfillments: [{ trackingCompany: "UPS", trackingNumber: "FIRST", trackingUrl: "https://example.com/first" }], refunds: [{ createdAt: "2026-07-06", amountCents: 2550, note: "Return" }], policies });
});
it("handles orders without transactions or tracking", () => {
  const raw = rawOrder(); raw.fulfillments[0].trackingInfo = []; raw.customer = null;
  expect(normalizeOrder(raw, policiesFromShop(null))).toMatchObject({ customer: null, payment: { last4: null, gateway: null }, fulfillments: [{ trackingNumber: null }] });
});
it("extracts and trims shop policies with null for blank or absent policies", () => {
  expect(policiesFromShop({ name: "Store", email: null, currencyCode: "USD", shopPolicies: [{ type: "REFUND_POLICY", body: " refund " }, { type: "SHIPPING_POLICY", body: "   " }, { type: "TERMS_OF_SERVICE", body: " terms " }] })).toEqual({ refund: "refund", shipping: null, terms: "terms" });
  expect(policiesFromShop(null)).toEqual({ refund: null, shipping: null, terms: null });
});
