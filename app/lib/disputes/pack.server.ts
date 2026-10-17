// The dispute loop: build the evidence pack, draft the response, let the
// merchant edit it, save it to Shopify, and submit it when they say so.

import type { Dispute } from "@prisma/client";
import prisma from "../../db.server";
import { planFor } from "../billing/plans";
import { logActivity, type StoreContext } from "../context.server";
import { PlanLimitError, UserFacingError } from "../errors";
import { fetchOrder, fetchShop, updateDisputeEvidence } from "../shopify/api.server";
import { normalizeOrder, policiesFromShop } from "../shopify/normalize";
import { aiAvailable, draftWithClaude, modelForPlan } from "./draft/ai.server";
import { draftFromTemplate, type DraftContext } from "./draft/template";
import { assess, formatMoney } from "./evidence";
import { evidenceUpdateInput } from "./evidence-input";
import {
  assessmentOf,
  canBuildPack,
  createDraft,
  latestDraft,
  recordPackUsage,
  rowToRemote,
  snapshotOf,
} from "./records.server";
import type { EvidenceFields, OrderSnapshot } from "./types";

function label(row: Dispute) {
  return row.orderName ?? "Dispute";
}

async function getDispute(ctx: StoreContext, disputeId: string): Promise<Dispute> {
  const row = await prisma.dispute.findFirst({ where: { id: disputeId, shopId: ctx.shop.id } });
  if (!row) throw new UserFacingError("That dispute doesn't exist in this store.");
  return row;
}

/** Every write goes through here: a dispute whose customer data was erased stays read-only. */
async function getWritableDispute(ctx: StoreContext, disputeId: string): Promise<Dispute> {
  const row = await getDispute(ctx, disputeId);
  if (row.redactedAt) throw new UserFacingError("The customer's data on this dispute was erased at their request.");
  return row;
}

function policiesFor(ctx: StoreContext, fromStore: OrderSnapshot["policies"] | undefined) {
  return {
    refund: ctx.shop.refundPolicy ?? fromStore?.refund ?? null,
    shipping: ctx.shop.shippingPolicy ?? fromStore?.shipping ?? null,
    terms: fromStore?.terms ?? null,
  };
}

/**
 * Pulls the order and everything around it, scores it for the dispute's
 * reason code and stores both on the dispute. The first pack for a dispute
 * counts against the monthly allowance; rebuilding it is free.
 */
export async function buildPack(ctx: StoreContext, disputeId: string) {
  const row = await getDispute(ctx, disputeId);
  if (!row.orderId) throw new UserFacingError("Shopify didn't link this dispute to an order, so there's nothing to build a pack from.");
  if (row.redactedAt) throw new UserFacingError("The customer's data on this dispute was erased at their request.");

  const firstBuild = !row.snapshotAt;
  if (firstBuild) {
    const allowance = await canBuildPack(ctx.shop);
    if (!allowance.ok) throw new PlanLimitError(allowance.used, allowance.limit);
  }

  const rawOrder = await fetchOrder(ctx.admin, row.orderId);
  if (!rawOrder) {
    throw new UserFacingError(
      `Shopify didn't return order ${row.orderName ?? row.orderId}. Orders older than 60 days need the read_all_orders scope (see docs/INSTALL.md).`,
    );
  }
  let storePolicies: OrderSnapshot["policies"] | undefined;
  try {
    storePolicies = policiesFromShop(await fetchShop(ctx.admin));
  } catch (error) {
    console.warn("[pack] could not read store policies", error);
  }
  const snapshot = normalizeOrder(rawOrder, policiesFor(ctx, storePolicies));
  const assessment = assess(rowToRemote(row), snapshot, {
    minFightAmountCents: ctx.shop.minFightAmountCents,
  });

  const updated = await prisma.dispute.update({
    where: { id: row.id },
    data: {
      snapshot: JSON.stringify(snapshot),
      snapshotAt: new Date(),
      score: assessment.score,
      recommendation: assessment.recommendation,
      assessment: JSON.stringify(assessment),
      customerId: snapshot.customer?.id ?? null,
      orderName: row.orderName || snapshot.orderName,
    },
  });
  if (firstBuild) await recordPackUsage(ctx.shop.id);
  await logActivity(
    ctx.shop.id,
    "pack_built",
    `${label(updated)}: evidence pack ${firstBuild ? "built" : "rebuilt"}, ${assessment.score}/100, recommend ${assessment.recommendation === "REVIEW" ? "a closer look" : assessment.recommendation.toLowerCase()}.`,
    { disputeId: row.id, actor: ctx.actor },
  );
  return { dispute: updated, snapshot, assessment };
}

/** Writes a new draft version. Claude when the plan and an API key allow it, otherwise the template. */
export async function draftEvidence(ctx: StoreContext, disputeId: string) {
  let row = await getWritableDispute(ctx, disputeId);
  if (!row.snapshot) row = (await buildPack(ctx, disputeId)).dispute;
  const snapshot = snapshotOf(row);
  const assessment = assessmentOf(row);
  if (!snapshot || !assessment) throw new UserFacingError("Build the evidence pack first.");

  const draftCtx: DraftContext = {
    dispute: rowToRemote(row),
    snapshot,
    assessment,
    shopName: ctx.shop.name ?? ctx.shop.domain,
    supportEmail: ctx.shop.supportEmail,
  };
  const plan = planFor(ctx.shop.plan);
  // The public demo never spends the operator's Anthropic credits unless asked to.
  const aiAllowed = plan.aiDrafts && (!ctx.isDemo || process.env.DEMO_AI === "on");
  const model = aiAllowed ? modelForPlan(plan.key) : null;
  let draft;
  if (model && aiAvailable()) {
    const ai = await draftWithClaude(draftCtx, model);
    if (ai) {
      draft = await createDraft(row.id, "AI", ai.fields, { model: ai.model, notes: ai.merchantNotes });
    }
  }
  if (!draft) {
    draft = await createDraft(row.id, "TEMPLATE", draftFromTemplate(draftCtx));
  }
  await logActivity(
    ctx.shop.id,
    "drafted",
    draft.source === "AI"
      ? `${label(row)}: Claude drafted response v${draft.version} (${draft.model}).`
      : `${label(row)}: response v${draft.version} drafted from the template.`,
    { disputeId: row.id, actor: ctx.actor },
  );
  return draft;
}

function sameFields(a: EvidenceFields, b: EvidenceFields) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Saves the merchant's edits as a new version if anything changed. */
export async function saveEdits(ctx: StoreContext, disputeId: string, fields: EvidenceFields) {
  const row = await getWritableDispute(ctx, disputeId);
  const current = await latestDraft(row.id);
  const currentFields = current ? (JSON.parse(current.fields) as EvidenceFields & { _notes?: string[] }) : {};
  const { _notes, ...withoutNotes } = currentFields;
  if (current && sameFields(withoutNotes, fields)) return current;
  const draft = await createDraft(row.id, "MERCHANT", fields, { notes: _notes });
  await logActivity(ctx.shop.id, "edited", `${label(row)}: response edited (v${draft.version}).`, { disputeId: row.id, actor: ctx.actor });
  return draft;
}

export interface SendResult {
  submitted: boolean;
  version: number;
}

/**
 * Sends the latest draft to Shopify. `submit: false` only stores it on the
 * dispute (the merchant can still change it in Shopify admin); `submit: true`
 * sends it to the bank, which cannot be undone.
 */
export async function sendToShopify(
  ctx: StoreContext,
  disputeId: string,
  fields: EvidenceFields,
  opts: { submit: boolean },
): Promise<SendResult> {
  const row = await getWritableDispute(ctx, disputeId);
  if (!row.evidenceId) throw new UserFacingError("Shopify hasn't opened an evidence form for this dispute yet. Sync and try again.");
  if (row.evidenceSentOn) throw new UserFacingError("Evidence for this dispute was already submitted.");
  if (row.status !== "NEEDS_RESPONSE") throw new UserFacingError("This dispute no longer accepts a response.");
  if (row.evidenceDueBy && row.evidenceDueBy < new Date()) {
    throw new UserFacingError("The evidence deadline has passed.");
  }
  if (opts.submit && !fields.uncategorizedText?.trim()) {
    throw new UserFacingError("Write a rebuttal letter before submitting.");
  }

  const draft = await saveEdits(ctx, disputeId, fields);
  const result = await updateDisputeEvidence(ctx.admin, row.evidenceId, evidenceUpdateInput(fields, opts.submit));
  if (result.errors.length) {
    await logActivity(ctx.shop.id, "error", `Shopify rejected the evidence: ${result.errors.join("; ")}`, {
      disputeId: row.id,
      actor: ctx.actor,
    });
    throw new UserFacingError(`Shopify rejected the evidence: ${result.errors.join("; ")}`);
  }
  if (opts.submit && !result.submitted) {
    // Saved, but Shopify didn't confirm the submission: don't mark it as sent.
    await prisma.evidenceDraft.update({ where: { id: draft.id }, data: { savedToShopifyAt: new Date() } });
    throw new UserFacingError(
      "Shopify saved the evidence but didn't confirm it was submitted. Check the dispute in your Shopify admin before trying again.",
    );
  }

  const now = new Date();
  await prisma.evidenceDraft.update({
    where: { id: draft.id },
    data: { savedToShopifyAt: now, submittedAt: opts.submit ? now : null },
  });
  if (opts.submit) {
    await prisma.dispute.update({
      where: { id: row.id },
      data: { evidenceSentOn: now, status: "UNDER_REVIEW", decision: "FIGHT" },
    });
    await logActivity(
      ctx.shop.id,
      "submitted",
      `${label(row)}: response v${draft.version} submitted to the bank for ${formatMoney(row.amountCents, row.currencyCode)}.`,
      { disputeId: row.id, actor: ctx.actor },
    );
  } else {
    await logActivity(ctx.shop.id, "saved", `${label(row)}: response v${draft.version} saved to Shopify (not submitted).`, {
      disputeId: row.id,
      actor: ctx.actor,
    });
  }
  return { submitted: opts.submit, version: draft.version };
}

/**
 * Accepting means not contesting: Shopify closes the dispute as lost when the
 * deadline passes without evidence. We record the decision so the inbox stops
 * nagging, and it can be reversed until the deadline.
 */
export async function decide(ctx: StoreContext, disputeId: string, decision: "FIGHT" | "ACCEPT" | null) {
  const row = await getWritableDispute(ctx, disputeId);
  if (row.evidenceSentOn) throw new UserFacingError("Evidence was already submitted for this dispute.");
  await prisma.dispute.update({ where: { id: row.id }, data: { decision } });
  await logActivity(
    ctx.shop.id,
    "decided",
    `${label(row)}: ` +
    (decision === "ACCEPT"
      ? "marked as accepted: StorePilot won't respond, and the dispute will close when the deadline passes."
      : decision === "FIGHT"
        ? "marked to fight."
        : "decision cleared."),
    { disputeId: row.id, actor: ctx.actor },
  );
}
