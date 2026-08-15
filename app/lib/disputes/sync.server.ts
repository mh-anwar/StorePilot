// Keeps the local Dispute table in step with Shopify: a full sync on install
// and on demand, plus disputes/create and disputes/update webhooks.

import type { Dispute } from "@prisma/client";
import prisma from "../../db.server";
import { planFor } from "../billing/plans";
import { logActivity, type StoreContext } from "../context.server";
import { fetchAllDisputes, fetchDispute } from "../shopify/api.server";
import { disputeFromWebhook, type DisputeWebhookPayload } from "../shopify/normalize";
import { formatMoney, reasonLabel } from "./evidence";
import { buildPack, draftEvidence } from "./pack.server";
import type { RemoteDispute } from "./types";

export interface UpsertResult {
  row: Dispute;
  created: boolean;
  statusChanged: boolean;
  previousStatus: string | null;
}

function toRow(remote: RemoteDispute) {
  return {
    evidenceId: remote.evidenceId,
    orderId: remote.order?.id ?? null,
    orderName: remote.order?.name || null,
    type: remote.type,
    status: remote.status,
    reason: remote.reason,
    networkReasonCode: remote.networkReasonCode,
    amountCents: remote.amountCents,
    currencyCode: remote.currencyCode,
    initiatedAt: new Date(remote.initiatedAt),
    evidenceDueBy: remote.evidenceDueBy ? new Date(remote.evidenceDueBy) : null,
    evidenceSentOn: remote.evidenceSentOn ? new Date(remote.evidenceSentOn) : null,
    finalizedOn: remote.finalizedOn ? new Date(remote.finalizedOn) : null,
  };
}

export async function upsertDispute(ctx: StoreContext, remote: RemoteDispute): Promise<UpsertResult> {
  const existing = await prisma.dispute.findUnique({
    where: { shopId_shopifyId: { shopId: ctx.shop.id, shopifyId: remote.id } },
  });
  const data = toRow(remote);
  if (!existing) {
    const row = await prisma.dispute.create({
      data: { ...data, shopId: ctx.shop.id, shopifyId: remote.id },
    });
    return { row, created: true, statusChanged: false, previousStatus: null };
  }
  // Webhook payloads don't carry the evidence id or order name; never blank
  // out what an earlier GraphQL read filled in.
  const row = await prisma.dispute.update({
    where: { id: existing.id },
    data: {
      ...data,
      evidenceId: data.evidenceId ?? existing.evidenceId,
      orderId: data.orderId ?? existing.orderId,
      orderName: data.orderName ?? existing.orderName,
    },
  });
  return {
    row,
    created: false,
    statusChanged: existing.status !== row.status,
    previousStatus: existing.status,
  };
}

const OUTCOME_TEXT: Record<string, string> = {
  WON: "won",
  LOST: "lost",
  ACCEPTED: "was accepted",
  CHARGE_REFUNDED: "closed because the charge was refunded",
  UNDER_REVIEW: "is under review by the bank",
};

async function logChanges(ctx: StoreContext, result: UpsertResult) {
  const { row } = result;
  const label = `${formatMoney(row.amountCents, row.currencyCode)} ${reasonLabel(row.reason as RemoteDispute["reason"])} dispute`;
  if (result.created) {
    await logActivity(ctx.shop.id, "dispute_opened", `New ${label}${row.orderName ? ` on ${row.orderName}` : ""}.`, {
      disputeId: row.id,
    });
  } else if (result.statusChanged) {
    const text = OUTCOME_TEXT[row.status] ?? `moved to ${row.status.toLowerCase()}`;
    const kind = ["WON", "LOST", "ACCEPTED", "CHARGE_REFUNDED"].includes(row.status) ? "outcome" : "dispute_updated";
    await logActivity(ctx.shop.id, kind, `The ${label} ${text}.`, {
      disputeId: row.id,
      meta: { from: result.previousStatus, to: row.status },
    });
  }
}

/** Full sync. Returns counts for the UI. */
export async function syncDisputes(ctx: StoreContext) {
  const remote = await fetchAllDisputes(ctx.admin);
  let created = 0;
  let updated = 0;
  for (const d of remote) {
    const result = await upsertDispute(ctx, d);
    if (result.created) created++;
    else if (result.statusChanged) updated++;
    await logChanges(ctx, result);
  }
  ctx.shop = await prisma.shop.update({
    where: { id: ctx.shop.id },
    data: { lastSyncedAt: new Date() },
  });
  await logActivity(ctx.shop.id, "synced", `Synced ${remote.length} disputes from Shopify (${created} new, ${updated} changed).`, {
    actor: ctx.actor,
  });
  return { total: remote.length, created, updated };
}

/**
 * disputes/create and disputes/update. The webhook body is the REST shape and
 * lacks the evidence id, so we re-read the dispute over GraphQL and fall back
 * to the payload if that fails (the next sync fills the gap).
 */
export async function handleDisputeWebhook(ctx: StoreContext, payload: DisputeWebhookPayload) {
  const fromPayload = disputeFromWebhook(payload);
  let remote = fromPayload;
  try {
    remote = (await fetchDispute(ctx.admin, fromPayload.id)) ?? fromPayload;
  } catch (error) {
    console.warn(`[webhook] could not re-read ${fromPayload.id}; using payload`, error);
  }
  const result = await upsertDispute(ctx, remote);
  await logChanges(ctx, result);

  // Pro (and shops that left auto-draft on): have the pack ready before the
  // merchant opens the app.
  const plan = planFor(ctx.shop.plan);
  if (result.created && plan.autoDraft && ctx.shop.autoDraft && result.row.status === "NEEDS_RESPONSE") {
    try {
      await buildPack(ctx, result.row.id);
      await draftEvidence(ctx, result.row.id);
    } catch (error) {
      console.warn(`[webhook] auto-draft skipped for ${result.row.id}`, error);
    }
  }
  return result;
}
