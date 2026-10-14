// Maps our EvidenceFields onto ShopifyPaymentsDisputeEvidenceUpdateInput.
// Pure, so the exact payload we send to Shopify is covered by tests.

import type { Address, EvidenceFields, EvidenceTextField } from "./types";

export const TEXT_FIELDS: EvidenceTextField[] = [
  "customerFirstName",
  "customerLastName",
  "customerEmailAddress",
  "accessActivityLog",
  "cancellationPolicyDisclosure",
  "cancellationRebuttal",
  "refundPolicyDisclosure",
  "refundRefusalExplanation",
  "uncategorizedText",
];

export const FIELD_LABELS: Record<EvidenceTextField, string> = {
  customerFirstName: "Customer first name",
  customerLastName: "Customer last name",
  customerEmailAddress: "Customer email",
  accessActivityLog: "Access and activity log",
  cancellationPolicyDisclosure: "Cancellation policy disclosure",
  cancellationRebuttal: "Cancellation rebuttal",
  refundPolicyDisclosure: "Refund policy disclosure",
  refundRefusalExplanation: "Refund refusal explanation",
  uncategorizedText: "Rebuttal letter",
};

export interface MailingAddressInput {
  address1?: string;
  address2?: string;
  city?: string;
  provinceCode?: string;
  zip?: string;
  countryCode?: string;
}

export function mailingAddress(a: Address): MailingAddressInput {
  const out: MailingAddressInput = {};
  if (a.address1) out.address1 = a.address1;
  if (a.address2) out.address2 = a.address2;
  if (a.city) out.city = a.city;
  if (a.provinceCode) out.provinceCode = a.provinceCode;
  if (a.zip) out.zip = a.zip;
  if (a.countryCode) out.countryCode = a.countryCode;
  return out;
}

/**
 * disputeEvidenceUpdate is a partial update, so every text field is sent:
 * an empty string clears a value an earlier "Save to Shopify" stored.
 * Otherwise text the merchant deleted could still reach the bank.
 */
export function evidenceUpdateInput(fields: EvidenceFields, submit: boolean) {
  const input: Record<string, unknown> = {};
  for (const key of TEXT_FIELDS) input[key] = fields[key]?.trim() ?? "";
  if (fields.shippingAddress) {
    const addr = mailingAddress(fields.shippingAddress);
    if (Object.keys(addr).length) input.shippingAddress = addr;
  }
  if (submit) input.submitEvidence = true;
  return input;
}

/** Turns a submitted form (field name -> text) back into EvidenceFields. */
export function fieldsFromForm(form: FormData, base: EvidenceFields): EvidenceFields {
  const next: EvidenceFields = { ...base };
  for (const key of TEXT_FIELDS) {
    if (!form.has(key)) continue;
    const value = String(form.get(key) ?? "").trim();
    if (value) next[key] = value;
    else delete next[key];
  }
  return next;
}
