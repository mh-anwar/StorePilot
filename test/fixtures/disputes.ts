import type { OrderSnapshot, RemoteDispute } from "../../app/lib/disputes/types";

export function makeDispute(overrides: Partial<RemoteDispute> = {}): RemoteDispute {
  return {
    id: "gid://shopify/ShopifyPaymentsDispute/101", evidenceId: null,
    type: "CHARGEBACK", status: "NEEDS_RESPONSE", reason: "PRODUCT_NOT_RECEIVED",
    networkReasonCode: null, amountCents: 12500, currencyCode: "USD",
    initiatedAt: "2026-07-10T12:00:00Z", evidenceDueBy: "2026-07-30T12:00:00Z",
    evidenceSentOn: null, finalizedOn: null,
    order: { id: "gid://shopify/Order/201", name: "#1001" }, ...overrides,
  };
}

/** Overrides replace top-level fields; every call returns fresh nested data. */
export function makeSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  const address = { name: "Ada Lovelace", address1: "10 King Street", address2: null, city: "Toronto", province: "ON", zip: "M5V 1A1", country: "Canada", countryCode: "CA" };
  return {
    orderId: "gid://shopify/Order/201", orderName: "#1001", createdAt: "2026-07-01T12:00:00Z",
    totalCents: 12500, currencyCode: "USD", sourceName: "web", tags: [],
    customer: { id: "gid://shopify/Customer/301", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", ordersCount: 4, totalSpentCents: 50000, createdAt: "2025-01-01T12:00:00Z" },
    billingAddress: { ...address }, shippingAddress: { ...address },
    lineItems: [{ title: "Canvas backpack", variantTitle: "Blue", sku: "BAG-BLUE", quantity: 1, unitPriceCents: 12500, requiresShipping: true }],
    payment: { gateway: "shopify_payments", cardBrand: "Visa", last4: "4242", avsResultCode: "Y", cvvResultCode: "M", browserIp: "192.0.2.1" },
    fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-07-02T12:00:00Z", deliveredAt: "2026-07-05T12:00:00Z", trackingCompany: "UPS", trackingNumber: "1Z123456789", trackingUrl: "https://www.ups.com/track?tracknum=1Z123456789" }],
    refunds: [],
    policies: {
      refund: "Returns are accepted within thirty days of delivery. Contact support for authorization and return unused items in their original packaging for a refund.",
      shipping: "Orders ship with tracked UPS delivery within two business days. Tracking details are emailed after dispatch and delivery normally takes five business days.",
      terms: "By completing checkout you agree to our purchase and cancellation terms. Subscription cancellations must be received before the next scheduled billing date.",
    }, ...overrides,
  };
}
