// Conversions between Prisma rows and domain types, plus usage counting.

import type { Dispute, EvidenceDraft, Shop } from "@prisma/client";
import prisma from "../../db.server";
import { periodKey, planFor } from "../billing/plans";
import type {
  Assessment,
  DraftSource,
  EvidenceFields,
  OrderSnapshot,
  RemoteDispute,
} from "./types";

export function rowToRemote(row: Dispute): RemoteDispute {
  return {
    id: row.shopifyId,
    evidenceId: row.evidenceId,
    type: row.type === "INQUIRY" ? "INQUIRY" : "CHARGEBACK",
    status: row.status as RemoteDispute["status"],
    reason: row.reason as RemoteDispute["reason"],
    networkReasonCode: row.networkReasonCode,
    amountCents: row.amountCents,
    currencyCode: row.currencyCode,
    initiatedAt: row.initiatedAt.toISOString(),
    evidenceDueBy: row.evidenceDueBy?.toISOString() ?? null,
    evidenceSentOn: row.evidenceSentOn?.toISOString() ?? null,
    finalizedOn: row.finalizedOn?.toISOString() ?? null,
    order: row.orderId ? { id: row.orderId, name: row.orderName ?? "" } : null,
  };
}

export function parseJson<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function snapshotOf(row: Dispute): OrderSnapshot | null {
  return parseJson<OrderSnapshot>(row.snapshot);
}

export function assessmentOf(row: Dispute): Assessment | null {
  return parseJson<Assessment>(row.assessment);
}

export interface DraftView {
  id: string;
  version: number;
  source: DraftSource;
  model: string | null;
  fields: EvidenceFields;
  notes: string[];
  savedToShopifyAt: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export function draftView(row: EvidenceDraft): DraftView {
  const stored = parseJson<EvidenceFields & { _notes?: string[] }>(row.fields) ?? {};
  const { _notes, ...fields } = stored;
  return {
    id: row.id,
    version: row.version,
    source: row.source as DraftSource,
    model: row.model,
    fields,
    notes: _notes ?? [],
    savedToShopifyAt: row.savedToShopifyAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function latestDraft(disputeId: string) {
  return prisma.evidenceDraft.findFirst({
    where: { disputeId },
    orderBy: { version: "desc" },
  });
}

export async function createDraft(
  disputeId: string,
  source: DraftSource,
  fields: EvidenceFields,
  opts: { model?: string | null; notes?: string[] } = {},
) {
  const previous = await latestDraft(disputeId);
  const stored = opts.notes?.length ? { ...fields, _notes: opts.notes } : fields;
  return prisma.evidenceDraft.create({
    data: {
      disputeId,
      version: (previous?.version ?? 0) + 1,
      source,
      model: opts.model ?? null,
      fields: JSON.stringify(stored),
    },
  });
}

export async function packsUsed(shopId: string, date = new Date()): Promise<number> {
  const row = await prisma.usageCounter.findUnique({
    where: { shopId_period: { shopId, period: periodKey(date) } },
  });
  return row?.packs ?? 0;
}

export async function recordPackUsage(shopId: string, date = new Date()) {
  const period = periodKey(date);
  await prisma.usageCounter.upsert({
    where: { shopId_period: { shopId, period } },
    create: { shopId, period, packs: 1 },
    update: { packs: { increment: 1 } },
  });
}

export async function canBuildPack(shop: Shop): Promise<{ ok: boolean; used: number; limit: number }> {
  const plan = planFor(shop.plan);
  const used = await packsUsed(shop.id);
  return { ok: used < plan.packsPerMonth, used, limit: plan.packsPerMonth };
}

/** Open = the merchant can still do something about it. */
export const OPEN_STATUSES = ["NEEDS_RESPONSE"] as const;
export const CLOSED_STATUSES = ["WON", "LOST", "ACCEPTED", "CHARGE_REFUNDED"] as const;
