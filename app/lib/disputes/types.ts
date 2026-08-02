// Domain types shared by the evidence builder, the drafter, the UI and the demo.
// Field names follow the Shopify Admin GraphQL API where one exists.

export const DISPUTE_REASONS = [
  "BANK_CANNOT_PROCESS",
  "CREDIT_NOT_PROCESSED",
  "CUSTOMER_INITIATED",
  "DEBIT_NOT_AUTHORIZED",
  "DUPLICATE",
  "FRAUDULENT",
  "GENERAL",
  "INCORRECT_ACCOUNT_DETAILS",
  "INSUFFICIENT_FUNDS",
  "PRODUCT_NOT_RECEIVED",
  "PRODUCT_UNACCEPTABLE",
  "SUBSCRIPTION_CANCELLED",
  "UNRECOGNIZED",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_STATUSES = [
  "NEEDS_RESPONSE",
  "UNDER_REVIEW",
  "CHARGE_REFUNDED",
  "ACCEPTED",
  "WON",
  "LOST",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export type DisputeType = "CHARGEBACK" | "INQUIRY";

/** A dispute as read from the Admin API, normalized. */
export interface RemoteDispute {
  id: string; // gid://shopify/ShopifyPaymentsDispute/…
  evidenceId: string | null;
  type: DisputeType;
  status: DisputeStatus;
  reason: DisputeReason;
  networkReasonCode: string | null;
  amountCents: number;
  currencyCode: string;
  initiatedAt: string; // ISO
  evidenceDueBy: string | null;
  evidenceSentOn: string | null;
  finalizedOn: string | null;
  order: { id: string; name: string } | null;
}

export interface Address {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

/** Everything we know about the disputed order, gathered once per pack. */
export interface OrderSnapshot {
  orderId: string;
  orderName: string;
  createdAt: string;
  totalCents: number;
  currencyCode: string;
  sourceName: string | null; // web, pos, shopify_draft_order…
  tags: string[];
  customer: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    ordersCount: number;
    totalSpentCents: number;
    createdAt: string | null;
  } | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  lineItems: Array<{
    title: string;
    variantTitle: string | null;
    sku: string | null;
    quantity: number;
    unitPriceCents: number;
    requiresShipping: boolean;
  }>;
  payment: {
    gateway: string | null;
    cardBrand: string | null;
    last4: string | null;
    avsResultCode: string | null;
    cvvResultCode: string | null;
    browserIp: string | null;
  };
  fulfillments: Array<{
    status: string; // SUCCESS, CANCELLED…
    displayStatus: string | null; // DELIVERED, IN_TRANSIT…
    createdAt: string;
    deliveredAt: string | null;
    trackingCompany: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  }>;
  refunds: Array<{ createdAt: string; amountCents: number; note: string | null }>;
  policies: {
    refund: string | null;
    shipping: string | null;
    terms: string | null;
  };
}

/** Text evidence we can send through disputeEvidenceUpdate. */
export interface EvidenceFields {
  customerFirstName?: string;
  customerLastName?: string;
  customerEmailAddress?: string;
  shippingAddress?: Address;
  accessActivityLog?: string;
  cancellationPolicyDisclosure?: string;
  cancellationRebuttal?: string;
  refundPolicyDisclosure?: string;
  refundRefusalExplanation?: string;
  uncategorizedText?: string;
}
export type EvidenceTextField = Exclude<keyof EvidenceFields, "shippingAddress">;

export type EvidenceStatus = "strong" | "weak" | "missing";

export interface EvidenceItem {
  key: string; // e.g. "delivery_confirmation"
  label: string; // "Delivery confirmation"
  status: EvidenceStatus;
  detail: string; // human sentence, e.g. "UPS shows delivered on Aug 3"
  weight: number; // contribution to the score when strong
}

export type Recommendation = "FIGHT" | "ACCEPT" | "REVIEW";

export interface Assessment {
  score: number; // 0..100 evidence strength for this reason code
  recommendation: Recommendation;
  reasons: string[]; // why we recommend what we recommend
  checklist: EvidenceItem[];
}

export type DraftSource = "AI" | "TEMPLATE" | "MERCHANT";
