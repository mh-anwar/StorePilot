// Claude-written evidence. The model gets the evidence pack (facts we pulled
// from Shopify, the assessment, the store policies) and returns the same
// EvidenceFields the template writer produces, as validated JSON.
//
// Model choice: Pro drafts with claude-sonnet-5-5 (better persuasive writing),
// Growth with claude-haiku-5-5 (cheap enough to run on every dispute).
// STOREPILOT_MODEL overrides both.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { reasonLabel } from "../evidence";
import type { EvidenceFields } from "../types";
import { clip, draftFromTemplate, FIELD_LIMIT, LETTER_LIMIT, type DraftContext } from "./template";

export const MODEL_PRO = "claude-sonnet-5-5";
export const MODEL_GROWTH = "claude-haiku-5-5";

const AddressSchema = z.object({
  address1: z.string().nullable(),
  address2: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
});

export const DraftSchema = z.object({
  rebuttalLetter: z
    .string()
    .describe("The main response to the bank, under 600 words. Facts only; cite dates, carriers, amounts."),
  accessActivityLog: z
    .string()
    .nullable()
    .describe("For fraud/unrecognized: IP, AVS/CVV results, account history. Null when not relevant."),
  refundPolicyDisclosure: z.string().nullable(),
  refundRefusalExplanation: z.string().nullable(),
  cancellationPolicyDisclosure: z.string().nullable(),
  cancellationRebuttal: z.string().nullable(),
  shippingAddress: AddressSchema.nullable(),
  merchantNotes: z
    .array(z.string())
    .describe("Short notes for the merchant (not sent to the bank): what to attach or double-check."),
});
export type ModelDraft = z.infer<typeof DraftSchema>;

// Stable across requests so it can be cached.
export const SYSTEM_PROMPT = `You write chargeback responses for Shopify merchants. The response goes to the cardholder's bank through Shopify Payments, and a bank analyst reads it in under two minutes.

Rules:
- Use only the facts in the evidence pack. Never invent tracking events, conversations, dates or policies. If a fact is missing, leave it out; do not speculate.
- Address the specific dispute reason. A "product not received" response leads with delivery proof; a "fraudulent" response leads with AVS/CVV, IP and the customer's order history; "product unacceptable" leads with the product description and refund policy; "credit not processed" leads with the refund record or why no refund was due.
- Plain, professional, factual English. No emotional language, no accusations against the cardholder, no legal threats.
- Rebuttal letter: an opening sentence naming the order, amount and reason; then the evidence in order of strength; then a one-line request to reverse the chargeback. Under 600 words.
- Policy fields quote the merchant's policy text; trim it to the relevant part.
- Return null for fields that do not apply to this dispute reason.
- merchantNotes: 1-4 short notes telling the merchant what documents would strengthen the case (e.g. a carrier delivery photo, emails with the customer).`;

export interface AiDraftResult {
  fields: EvidenceFields;
  model: string;
  merchantNotes: string[];
}

export function modelForPlan(plan: string): string | null {
  if (process.env.STOREPILOT_MODEL) return process.env.STOREPILOT_MODEL;
  if (plan === "pro") return MODEL_PRO;
  if (plan === "growth") return MODEL_GROWTH;
  return null;
}

export function evidencePackPrompt(ctx: DraftContext): string {
  const { dispute: d, snapshot, assessment, shopName, supportEmail } = ctx;
  return JSON.stringify(
    {
      store: { name: shopName, supportEmail: supportEmail ?? null },
      dispute: {
        type: d.type,
        reason: d.reason,
        reasonLabel: reasonLabel(d.reason),
        networkReasonCode: d.networkReasonCode,
        amountCents: d.amountCents,
        currencyCode: d.currencyCode,
        initiatedAt: d.initiatedAt,
        evidenceDueBy: d.evidenceDueBy,
      },
      order: snapshot,
      assessment: {
        score: assessment.score,
        recommendation: assessment.recommendation,
        checklist: assessment.checklist.map(({ label, status, detail }) => ({ label, status, detail })),
      },
    },
    null,
    2,
  );
}

/** Merge model output with the facts we never let the model write (names, email). */
export function fieldsFromModel(ctx: DraftContext, draft: ModelDraft): EvidenceFields {
  const base = draftFromTemplate(ctx);
  const fields: EvidenceFields = {
    customerFirstName: base.customerFirstName,
    customerLastName: base.customerLastName,
    customerEmailAddress: base.customerEmailAddress,
    // The shipping address must match Shopify's record; prefer the snapshot.
    shippingAddress: base.shippingAddress ?? (draft.shippingAddress ?? undefined),
    uncategorizedText: clip(draft.rebuttalLetter, LETTER_LIMIT),
  };
  const optional = [
    "accessActivityLog",
    "refundPolicyDisclosure",
    "refundRefusalExplanation",
    "cancellationPolicyDisclosure",
    "cancellationRebuttal",
  ] as const;
  for (const key of optional) {
    const value = draft[key];
    if (value && value.trim()) fields[key] = clip(value, FIELD_LIMIT);
  }
  for (const key of Object.keys(fields) as (keyof EvidenceFields)[]) {
    if (fields[key] === undefined) delete fields[key];
  }
  return fields;
}

export interface MessagesClient {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
}

let client: MessagesClient | null = null;
export function setAnthropicClient(c: MessagesClient | null) {
  client = c;
}
function getClient(): MessagesClient | null {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic({ maxRetries: 2, timeout: 90_000 });
  return client;
}

export function aiAvailable(): boolean {
  return Boolean(client || process.env.ANTHROPIC_API_KEY);
}

/**
 * Returns null when AI drafting isn't available or fails; callers fall back to
 * the template writer. Errors are logged, never shown to the bank.
 */
export async function draftWithClaude(
  ctx: DraftContext,
  model: string,
): Promise<AiDraftResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  // Sonnet supports server-side fallback on refusals; Haiku does not.
  const fallback = model.startsWith("claude-sonnet")
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  try {
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
      messages: [
        {
          role: "user",
          content: `Draft the evidence for this ${reasonLabel(ctx.dispute.reason)} dispute.\n\nEvidence pack:\n${evidencePackPrompt(ctx)}`,
        },
      ],
      ...fallback,
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn(`[draft] ${model} stopped with ${response.stop_reason}; using template`);
      return null;
    }
    const parsed = response.parsed_output;
    if (!parsed) return null;
    return {
      fields: fieldsFromModel(ctx, parsed),
      model: response.model ?? model,
      merchantNotes: parsed.merchantNotes.slice(0, 4),
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("[draft] rate limited; using template");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[draft] Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error("[draft] failed", error);
    }
    return null;
  }
}
