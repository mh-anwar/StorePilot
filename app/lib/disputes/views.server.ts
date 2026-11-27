// Read models for the UI: the inbox, the dashboard numbers, and the detail page.
// Everything returned here is plain JSON so it can cross the loader boundary.

import prisma from "../../db.server";
import { planFor, packsRemaining } from "../billing/plans";
import type { StoreContext } from "../context.server";
import { UserFacingError } from "../errors";
import { reasonLabel } from "./evidence";
import { assessmentOf, draftView, packsUsed, snapshotOf } from "./records.server";
import type { DisputeReason } from "./types";

export type InboxTab = "open" | "submitted" | "closed" | "all";

const TAB_WHERE: Record<InboxTab, object> = {
  open: { status: "NEEDS_RESPONSE" },
  submitted: { status: "UNDER_REVIEW" },
  closed: { status: { in: ["WON", "LOST", "ACCEPTED", "CHARGE_REFUNDED"] } },
  all: {},
};

export interface InboxRow {
  id: string;
  orderName: string | null;
  reason: string;
  reasonLabel: string;
  type: string;
  status: string;
  amountCents: number;
  currencyCode: string;
  initiatedAt: string;
  evidenceDueBy: string | null;
  daysLeft: number | null;
  score: number | null;
  recommendation: string | null;
  decision: string | null;
  hasDraft: boolean;
}

export function daysLeft(due: Date | null, now = new Date()): number | null {
  if (!due) return null;
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

export async function listDisputes(ctx: StoreContext, tab: InboxTab = "open"): Promise<InboxRow[]> {
  const rows = await prisma.dispute.findMany({
    where: { shopId: ctx.shop.id, ...TAB_WHERE[tab] },
    orderBy: tab === "open" ? [{ evidenceDueBy: "asc" }] : [{ initiatedAt: "desc" }],
    include: { _count: { select: { drafts: true } } },
    take: 200,
  });
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    orderName: r.orderName,
    reason: r.reason,
    reasonLabel: reasonLabel(r.reason as DisputeReason),
    type: r.type,
    status: r.status,
    amountCents: r.amountCents,
    currencyCode: r.currencyCode,
    initiatedAt: r.initiatedAt.toISOString(),
    evidenceDueBy: r.evidenceDueBy?.toISOString() ?? null,
    daysLeft: r.status === "NEEDS_RESPONSE" ? daysLeft(r.evidenceDueBy, now) : null,
    score: r.score,
    recommendation: r.recommendation,
    decision: r.decision,
    hasDraft: r._count.drafts > 0,
  }));
}

export interface DashboardStats {
  total: number; // every dispute on record, any status
  open: number;
  dueSoon: number; // open, due within 3 days
  atStakeCents: number; // open amount
  recoveredCents: number; // won amount
  lostCents: number;
  /** Lost disputes that never got a response: the money StorePilot exists to save. */
  unanswered: number;
  unansweredCents: number;
  won: number;
  lost: number;
  winRate: number | null; // 0..100, of decided disputes
  currencyCode: string;
  plan: { key: string; label: string; packsUsed: number; packsLimit: number | null; packsLeft: number | null };
  lastSyncedAt: string | null;
}

export async function dashboardStats(ctx: StoreContext): Promise<DashboardStats> {
  const rows = await prisma.dispute.findMany({
    where: { shopId: ctx.shop.id },
    select: { status: true, amountCents: true, evidenceDueBy: true, decision: true, evidenceSentOn: true },
  });
  const now = new Date();
  let open = 0, dueSoon = 0, atStake = 0, recovered = 0, lostCents = 0, won = 0, lost = 0;
  let unanswered = 0, unansweredCents = 0;
  for (const r of rows) {
    if (r.status === "NEEDS_RESPONSE") {
      open++;
      atStake += r.amountCents;
      const left = daysLeft(r.evidenceDueBy, now);
      if (left !== null && left <= 3 && left >= 0 && r.decision !== "ACCEPT") dueSoon++;
    } else if (r.status === "WON") {
      won++;
      recovered += r.amountCents;
    } else if (r.status === "LOST") {
      lost++;
      lostCents += r.amountCents;
      if (!r.evidenceSentOn) {
        unanswered++;
        unansweredCents += r.amountCents;
      }
    }
  }
  const plan = planFor(ctx.shop.plan);
  const used = await packsUsed(ctx.shop.id);
  const unlimited = !Number.isFinite(plan.packsPerMonth);
  return {
    total: rows.length,
    open,
    dueSoon,
    atStakeCents: atStake,
    recoveredCents: recovered,
    lostCents,
    unanswered,
    unansweredCents,
    won,
    lost,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    currencyCode: ctx.shop.currencyCode,
    plan: {
      key: plan.key,
      label: plan.label,
      packsUsed: used,
      packsLimit: unlimited ? null : plan.packsPerMonth,
      packsLeft: unlimited ? null : packsRemaining(plan, used),
    },
    lastSyncedAt: ctx.shop.lastSyncedAt?.toISOString() ?? null,
  };
}

/** The store's own numbers, shown on the Plans page as the reason to pick a plan. */
export function plansRecord(stats: DashboardStats) {
  return {
    recoveredCents: stats.recoveredCents,
    won: stats.won,
    unanswered: stats.unanswered,
    unansweredCents: stats.unansweredCents,
    atStakeCents: stats.atStakeCents,
    open: stats.open,
    currencyCode: stats.currencyCode,
  };
}
export type PlansRecord = ReturnType<typeof plansRecord>;

export async function disputeDetail(ctx: StoreContext, disputeId: string) {
  const row = await prisma.dispute.findFirst({
    where: { id: disputeId, shopId: ctx.shop.id },
    include: {
      drafts: { orderBy: { version: "desc" }, take: 20 },
      activities: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!row) throw new UserFacingError("Dispute not found.");
  const editable =
    row.status === "NEEDS_RESPONSE" &&
    !row.evidenceSentOn &&
    !row.redactedAt &&
    !(row.evidenceDueBy && row.evidenceDueBy < new Date());
  return {
    dispute: {
      id: row.id,
      shopifyId: row.shopifyId,
      orderId: row.orderId,
      orderName: row.orderName,
      type: row.type,
      status: row.status,
      reason: row.reason,
      reasonLabel: reasonLabel(row.reason as DisputeReason),
      networkReasonCode: row.networkReasonCode,
      amountCents: row.amountCents,
      currencyCode: row.currencyCode,
      initiatedAt: row.initiatedAt.toISOString(),
      evidenceDueBy: row.evidenceDueBy?.toISOString() ?? null,
      evidenceSentOn: row.evidenceSentOn?.toISOString() ?? null,
      finalizedOn: row.finalizedOn?.toISOString() ?? null,
      daysLeft: row.status === "NEEDS_RESPONSE" ? daysLeft(row.evidenceDueBy) : null,
      decision: row.decision,
      redactedAt: row.redactedAt?.toISOString() ?? null,
      snapshotAt: row.snapshotAt?.toISOString() ?? null,
    },
    editable,
    snapshot: snapshotOf(row),
    assessment: assessmentOf(row),
    drafts: row.drafts.map(draftView),
    activity: row.activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      message: a.message,
      actor: a.actor,
      createdAt: a.createdAt.toISOString(),
    })),
    plan: planFor(ctx.shop.plan).key,
  };
}

export async function recentActivity(ctx: StoreContext, take = 8) {
  const rows = await prisma.activity.findMany({
    where: { shopId: ctx.shop.id },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    message: a.message,
    disputeId: a.disputeId,
    createdAt: a.createdAt.toISOString(),
  }));
}
