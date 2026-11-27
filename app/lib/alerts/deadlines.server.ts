// Deadline alert emails (Growth and Pro).
//
// A dispute that nobody answers is closed as lost, and the merchant usually
// finds out weeks later. This sends one digest per shop when a dispute is new
// and again as its deadline crosses 7, 3 and 1 days left. Each dispute
// remembers the smallest threshold already emailed (Dispute.alertStage), so a
// run can repeat every hour without sending duplicates.

import prisma from "../../db.server";
import { planFor } from "../billing/plans";
import { logActivity } from "../context.server";
import { formatMoney, reasonLabel } from "../disputes/evidence";
import type { DisputeReason } from "../disputes/types";
import { daysLeft } from "../disputes/views.server";
import { emailConfigured, sendEmail } from "./email.server";
import { runMonthlySummaries } from "./summary.server";

/** "New" stage: any open dispute we haven't emailed about yet. */
export const STAGE_NEW = 99;
const THRESHOLDS = [1, 3, 7] as const;

/** The stage a dispute is in for a given number of days left. */
export function stageFor(days: number): number {
  for (const t of THRESHOLDS) if (days <= t) return t;
  return STAGE_NEW;
}

/** True when this dispute has reached a stage we haven't emailed about. */
export function needsAlert(days: number, lastStage: number | null): boolean {
  return stageFor(days) < (lastStage ?? Number.POSITIVE_INFINITY);
}

export function dueText(days: number): string {
  if (days <= 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

/** A link into the embedded app. /admin/apps/<client id> redirects to it in the new admin. */
export function adminAppUrl(shopDomain: string, path = ""): string {
  const key = process.env.SHOPIFY_API_KEY;
  return key ? `https://${shopDomain}/admin/apps/${key}/app${path}` : `https://${shopDomain}/admin/apps`;
}

export function disputeUrl(shopDomain: string, disputeId: string): string {
  return adminAppUrl(shopDomain, `/disputes/${disputeId}`);
}

interface AlertItem {
  id: string;
  orderName: string | null;
  reason: string;
  amountCents: number;
  currencyCode: string;
  days: number;
  stage: number;
  recommendation: string | null;
}

export function digest(shopName: string, shopDomain: string, items: AlertItem[]) {
  const sorted = [...items].sort((a, b) => a.days - b.days);
  const first = sorted[0];
  const subject =
    sorted.length === 1
      ? `Chargeback on ${first.orderName ?? "an order"} ${dueText(first.days)} (${formatMoney(first.amountCents, first.currencyCode)})`
      : `${sorted.length} chargebacks need a response, the first ${dueText(first.days)}`;
  const lines = sorted.map((d) => {
    const rec = d.recommendation ? ` StorePilot suggests: ${d.recommendation === "FIGHT" ? "fight" : d.recommendation === "ACCEPT" ? "accept" : "your call"}.` : "";
    return [
      `- ${d.orderName ?? "No order"}: ${formatMoney(d.amountCents, d.currencyCode)}, ${reasonLabel(d.reason as DisputeReason)}, ${dueText(d.days)}.${rec}`,
      `  ${disputeUrl(shopDomain, d.id)}`,
    ].join("\n");
  });
  const text = [
    `Hi ${shopName},`,
    "",
    sorted.length === 1
      ? "A Shopify Payments dispute on your store still needs a response:"
      : "These Shopify Payments disputes on your store still need a response:",
    "",
    ...lines,
    "",
    "If no evidence reaches the bank by the deadline, Shopify closes the dispute as lost and the chargeback fee is not returned.",
    "The evidence pack and a draft are waiting in StorePilot. Review it, edit anything, and submit. Nothing is sent until you do.",
    "",
    "You get these emails because deadline alerts are on in StorePilot settings. Turn them off there any time.",
  ].join("\n");
  return { subject, text };
}

export interface AlertRunResult {
  skipped?: string;
  shops: number;
  emails: number;
  disputes: number;
  failures: number;
}

export async function runDeadlineAlerts(now = new Date()): Promise<AlertRunResult> {
  const result: AlertRunResult = { shops: 0, emails: 0, disputes: 0, failures: 0 };
  if (!emailConfigured()) return { ...result, skipped: "email not configured" };

  const shops = await prisma.shop.findMany({
    where: { uninstalledAt: null, isDemo: false, deadlineAlerts: true, plan: { not: "free" } },
  });
  for (const shop of shops) {
    if (!planFor(shop.plan).deadlineAlerts) continue;
    const to = (shop.alertEmail ?? shop.email ?? "").trim();
    if (!to) continue;
    result.shops++;

    const open = await prisma.dispute.findMany({
      where: {
        shopId: shop.id,
        status: "NEEDS_RESPONSE",
        evidenceSentOn: null,
        redactedAt: null,
        evidenceDueBy: { gt: now },
        OR: [{ decision: null }, { decision: { not: "ACCEPT" } }],
      },
    });
    const items: AlertItem[] = [];
    for (const d of open) {
      const days = daysLeft(d.evidenceDueBy, now);
      if (days === null || !needsAlert(days, d.alertStage)) continue;
      items.push({
        id: d.id,
        orderName: d.orderName,
        reason: d.reason,
        amountCents: d.amountCents,
        currencyCode: d.currencyCode,
        days,
        stage: stageFor(days),
        recommendation: d.recommendation,
      });
    }
    if (!items.length) continue;

    const { subject, text } = digest(shop.name ?? shop.domain, shop.domain, items);
    const sent = await sendEmail({ to, subject, text });
    if (!sent.sent) {
      result.failures++;
      console.warn(`[alerts] ${shop.domain}: ${sent.reason}`);
      continue;
    }
    result.emails++;
    result.disputes += items.length;
    for (const item of items) {
      await prisma.dispute.update({ where: { id: item.id }, data: { alertStage: item.stage } });
    }
    await logActivity(shop.id, "alerted", `Emailed a deadline alert to ${to} about ${items.length} dispute${items.length === 1 ? "" : "s"}.`, {
      actor: "system",
      meta: { disputes: items.map((i) => i.id) },
    });
  }
  return result;
}

// In-process scheduler. StorePilot runs as a single instance (SQLite on one
// disk), so an hourly timer is enough; /cron/deadlines can also trigger a run.
const HOUR = 60 * 60 * 1000;
declare global {
  // eslint-disable-next-line no-var
  var __storepilotAlertTimer: ReturnType<typeof setInterval> | undefined;
}

export function startAlertScheduler() {
  if (globalThis.__storepilotAlertTimer) return;
  if (process.env.NODE_ENV === "test" || process.env.VITEST || process.env.DEADLINE_ALERTS === "off") return;
  const tick = async () => {
    try {
      const r = await runDeadlineAlerts();
      if (r.emails || r.failures) console.log("[alerts]", JSON.stringify(r));
      const m = await runMonthlySummaries();
      if (m.emails || m.failures) console.log("[summary]", JSON.stringify(m));
    } catch (error) {
      console.error("[alerts] run failed", error);
    }
  };
  globalThis.__storepilotAlertTimer = setInterval(tick, HOUR);
  globalThis.__storepilotAlertTimer.unref?.();
  setTimeout(tick, 60_000).unref?.();
}
