// Public guides: how to answer each kind of Shopify Payments chargeback.
// They're the search-engine entry point for merchants who just got a dispute
// email, and they follow the same checklists StorePilot scores against
// (app/lib/disputes/evidence.ts), so the advice and the product agree.
// Client-safe: plain data.

import type { DisputeReason } from "./disputes/types";

export interface Guide {
  slug: string;
  reasons: DisputeReason[];
  title: string; // <title> and <h1>
  description: string; // meta description, at most ~160 characters
  claim: string; // what the customer's bank is saying
  evidence: Array<{ item: string; why: string }>; // in order of weight
  accept: string; // when it isn't worth fighting
  mistakes: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "product-not-received",
    reasons: ["PRODUCT_NOT_RECEIVED"],
    title: "How to answer a “product not received” chargeback on Shopify",
    description:
      "The customer says the order never arrived. What evidence wins a Shopify Payments “not received” dispute, and when to accept it instead.",
    claim:
      "The cardholder told their bank the order never arrived. The bank wants to see that you shipped it to the address they gave and that it was delivered.",
    evidence: [
      { item: "Carrier proof of delivery", why: "The single strongest piece. A delivered scan with a date on the tracking page usually decides the case." },
      { item: "Tracking number and carrier", why: "Lets the bank check the delivery themselves. Include the tracking link, not only the number." },
      { item: "Shipping address matches the billing address", why: "Shows the parcel went where the cardholder lives, not to a forwarding address." },
      { item: "The customer's order history", why: "Earlier orders that arrived without complaint make a sudden “never arrived” less believable." },
      { item: "Your shipping policy", why: "Especially the part about who is responsible once the carrier marks a parcel delivered." },
    ],
    accept:
      "If the parcel was shipped without tracking, or tracking stops before delivery, you have little to show. For small orders, accepting and reshipping or refunding is usually cheaper than a long dispute.",
    mistakes: [
      "Sending tracking for a different order, or only the number without the carrier.",
      "Writing a long story instead of pointing at the delivery scan.",
      "Missing the deadline: Shopify closes the dispute as lost if nothing is submitted.",
    ],
  },
  {
    slug: "fraudulent",
    reasons: ["FRAUDULENT", "UNRECOGNIZED", "DEBIT_NOT_AUTHORIZED"],
    title: "How to answer a “fraudulent” or “unrecognized” chargeback on Shopify",
    description:
      "The cardholder says they didn't make the purchase. Which payment checks and order details win a Shopify Payments fraud dispute.",
    claim:
      "The cardholder says they didn't authorize the payment, or don't recognize it. The bank wants signs that the real cardholder placed the order.",
    evidence: [
      { item: "Address verification (AVS) result", why: "A full match means whoever paid knew the cardholder's billing street and postal code." },
      { item: "Security code (CVV) result", why: "A match shows the person had the physical card or its full details." },
      { item: "Proof of delivery", why: "Delivered to the billing address is strong; delivered to an unrelated address weakens the case." },
      { item: "Customer history", why: "Earlier undisputed orders from the same customer and card suggest a forgotten purchase, not fraud." },
      { item: "IP address and device", why: "An IP in the cardholder's region supports that they placed the order." },
      { item: "Shipping address matches billing", why: "Fraudsters usually ship elsewhere. A match is a good sign for you." },
    ],
    accept:
      "If AVS and CVV failed or were unavailable, the order shipped to a different address, and the customer is new, the order was probably fraud. Accept it, and look at your fraud settings so the next one is caught earlier.",
    mistakes: [
      "Arguing that Shopify's fraud analysis said “low risk”. Banks want the underlying checks, not a score.",
      "Leaving out the customer's past orders when they exist.",
      "For “unrecognized” claims: not mentioning the store name the customer would see on their statement.",
    ],
  },
  {
    slug: "product-unacceptable",
    reasons: ["PRODUCT_UNACCEPTABLE"],
    title: "How to answer a “not as described” chargeback on Shopify",
    description:
      "The customer says the item was defective or not as described. What evidence wins a Shopify Payments “product unacceptable” dispute.",
    claim:
      "The cardholder says what they received was damaged, defective, or different from the listing. The bank wants to know what you promised and whether you offered a fair fix.",
    evidence: [
      { item: "Your refund and return policy", why: "Shows the customer had a way to return the item and didn't use it." },
      { item: "The product description and photos", why: "Lets the bank compare what was listed with what the customer says arrived." },
      { item: "Proof of delivery", why: "Confirms which item arrived and when, which matters for return windows." },
      { item: "Customer history and messages", why: "Any conversation where you offered a return, exchange or partial refund helps a lot." },
      { item: "Tracking", why: "Supports the delivery date for your return-window argument." },
    ],
    accept:
      "If the customer contacted you first and you didn't respond, or the product really was not as described, accept and refund. Banks side with customers who tried to resolve it with you.",
    mistakes: [
      "Not explaining why a refund was refused (for example, the return window had passed).",
      "Quoting a refund policy that wasn't visible at checkout.",
    ],
  },
  {
    slug: "credit-not-processed",
    reasons: ["CREDIT_NOT_PROCESSED"],
    title: "How to answer a “credit not processed” chargeback on Shopify",
    description:
      "The customer says they were promised a refund that never came. How to answer a Shopify Payments “credit not processed” dispute.",
    claim:
      "The cardholder says they returned the item or were promised a refund that they never received.",
    evidence: [
      { item: "The refund record", why: "If you already refunded, the date and amount usually win the dispute outright." },
      { item: "Your refund policy", why: "If no refund was due, the policy explains why (return window, condition, final sale)." },
      { item: "Proof of delivery", why: "Supports when the return window started." },
    ],
    accept:
      "If the customer returned the item and you haven't refunded yet, accept the dispute rather than refunding as well: refunding and losing the dispute means paying twice.",
    mistakes: [
      "Issuing a refund after the dispute opened and not saying so in the response.",
      "Not stating which part of the policy made the order non-refundable.",
    ],
  },
  {
    slug: "subscription-cancelled",
    reasons: ["SUBSCRIPTION_CANCELLED"],
    title: "How to answer a “subscription cancelled” chargeback on Shopify",
    description:
      "The customer says they cancelled but were still charged. How to answer a Shopify Payments subscription dispute.",
    claim:
      "The cardholder says they cancelled a subscription and were charged anyway.",
    evidence: [
      { item: "Your subscription terms and cancellation policy", why: "Shows how and when cancellations take effect, and that the customer agreed to it." },
      { item: "Your refund policy", why: "Covers whether charges already processed can be refunded." },
      { item: "Customer history", why: "Shows the earlier charges the customer did not dispute." },
      { item: "Proof of delivery for this period", why: "Shows the customer received what this charge paid for." },
    ],
    accept:
      "If the customer cancelled before the renewal date and you have no record showing otherwise, accept it and check your cancellation flow.",
    mistakes: [
      "Not explaining when the cancellation would have taken effect.",
      "Leaving out that the shipment for the disputed period was delivered.",
    ],
  },
  {
    slug: "duplicate-charge",
    reasons: ["DUPLICATE"],
    title: "How to answer a “duplicate charge” chargeback on Shopify",
    description:
      "The customer says they were charged twice. How to show the charges were for separate orders in a Shopify Payments dispute.",
    claim: "The cardholder says the same purchase was charged more than once.",
    evidence: [
      { item: "Both orders, side by side", why: "Different items, dates or amounts show the charges were for separate purchases." },
      { item: "Proof of delivery for each", why: "Two deliveries for two orders is hard to argue with." },
      { item: "Any refund of the duplicate", why: "If one charge was already refunded, the dispute should be closed in your favour." },
      { item: "Customer history", why: "Shows a pattern of separate purchases." },
    ],
    accept: "If it really was charged twice and you haven't refunded, accept the dispute rather than refunding as well.",
    mistakes: ["Not explaining which order each charge belongs to."],
  },
  {
    slug: "general-dispute",
    reasons: ["GENERAL", "CUSTOMER_INITIATED"],
    title: "How to answer a “general” chargeback on Shopify",
    description:
      "The dispute reason is “general” or “customer initiated”, so the claim is vague. What to send so the bank sees a complete, legitimate order.",
    claim:
      "The bank didn't say exactly what the cardholder is unhappy about. Without a specific claim to rebut, the job is to show the whole order was legitimate, delivered and handled fairly.",
    evidence: [
      { item: "Proof of delivery", why: "The most general proof that the customer got what they paid for." },
      { item: "AVS and CVV results", why: "Shows the real cardholder placed the order." },
      { item: "Customer history", why: "Earlier undisputed orders support a legitimate customer relationship." },
      { item: "Your refund policy", why: "Shows the customer had a way to resolve a problem with you directly." },
      { item: "The product description", why: "Lets the bank see what was sold, in case the real complaint is about the product." },
    ],
    accept:
      "If you can't find any message from the customer and the order has no tracking, a vague dispute is hard to win. On small amounts, accepting is often the better use of your time.",
    mistakes: [
      "Guessing at the customer's complaint and arguing only that point.",
      "Not checking your inbox: the customer may have written to you first, and that message often explains the dispute.",
    ],
  },
  {
    slug: "inquiry",
    reasons: [],
    title: "How to answer a Shopify Payments inquiry before it becomes a chargeback",
    description:
      "An inquiry is the bank asking questions before a chargeback. No money has moved yet. What to send so it closes in your favour.",
    claim:
      "The cardholder's bank is asking about a charge before deciding whether to file a chargeback. The money hasn't been taken back yet, so a clear answer now can stop the dispute entirely.",
    evidence: [
      { item: "What was bought and when", why: "The order, the items and the date, so the cardholder recognizes the purchase." },
      { item: "The name on their statement", why: "Many inquiries are customers who don't recognize the store name on their bank statement." },
      { item: "Proof of delivery", why: "Shows the order arrived, which answers most questions on its own." },
      { item: "AVS and CVV results", why: "If fraud is suspected, shows the real cardholder's details were used." },
      { item: "How to reach you", why: "A support email and your refund policy show the customer can sort it out with you directly." },
    ],
    accept:
      "If the order really was a mistake or never shipped, refund it now. That usually closes the inquiry without a chargeback fee.",
    mistakes: [
      "Ignoring it because no money has moved yet. An unanswered inquiry often becomes a chargeback.",
      "Answering after the deadline: inquiries have one too.",
    ],
  },
];

export function guideForReason(reason: string): Guide | undefined {
  return GUIDES.find((g) => (g.reasons as string[]).includes(reason));
}

export function guideBySlug(slug: string | undefined): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** schema.org Article for a guide. "<" is escaped so the JSON can't close its script tag. */
export function guideJsonLd(guide: Guide, url: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url,
    publisher: { "@type": "Organization", name: "StorePilot" },
  }).replace(/</g, "\\u003c");
}
