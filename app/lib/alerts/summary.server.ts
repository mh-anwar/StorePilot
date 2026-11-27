// Monthly summary email (every plan). Early each month, each store with any
// dispute activity last month gets one short email: disputes opened, responses
// sent, won and lost, money recovered, and anything still open. It's the
// reminder that StorePilot is working even in months nobody opens the app,
// and for Free stores it names the money lost to disputes nobody answered.
//
// Shop.summaryMonth records the last month handled ("YYYY-MM"), so the hourly
// run sends at most one email per store per month and retries failed sends.

import prisma from "../../db.server";
import { planFor, periodKey } from "../billing/plans";
import { logActivity } from "../context.server";
import { formatMoney } from "../disputes/evidence";
import { adminAppUrl } from "./deadlines.server";
import { emailConfigured, sendEmail } from "./email.server";

export function previousMonth(now: Date): { start: Date; end: Date; key: string; label: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, key: periodKey(start), label };
}

export interface MonthSummary {
  opened: number;
  openedCents: number;
  answered: number;
  won: number;
  wonCents: number;
  lost: number;
  unanswered: number;
  unansweredCents: number;
  openNow: number;
  currencyCode: string;
}

export async function summarize(shopId: string, currencyCode: string, start: Date, end: Date): Promise<MonthSummary> {
  const inMonth = { gte: start, lt: end };
  const [opened, answered, finalized, openNow] = await Promise.all([
    prisma.dispute.findMany({ where: { shopId, initiatedAt: inMonth }, select: { amountCents: true } }),
    prisma.dispute.count({ where: { shopId, evidenceSentOn: inMonth } }),
    prisma.dispute.findMany({
      where: { shopId, finalizedOn: inMonth, status: { in: ["WON", "LOST"] } },
      select: { status: true, amountCents: true, evidenceSentOn: true },
    }),
    prisma.dispute.count({ where: { shopId, status: "NEEDS_RESPONSE" } }),
  ]);
  const won = finalized.filter((d) => d.status === "WON");
  const lost = finalized.filter((d) => d.status === "LOST");
  const unanswered = lost.filter((d) => !d.evidenceSentOn);
  const sum = (rows: Array<{ amountCents: number }>) => rows.reduce((s, r) => s + r.amountCents, 0);
  return {
    opened: opened.length,
    openedCents: sum(opened),
    answered,
    won: won.length,
    wonCents: sum(won),
    lost: lost.length,
    unanswered: unanswered.length,
    unansweredCents: sum(unanswered),
    openNow,
    currencyCode,
  };
}

export function isQuiet(s: MonthSummary): boolean {
  return s.opened + s.answered + s.won + s.lost === 0;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function summaryEmail(shopName: string, shopDomain: string, month: string, s: MonthSummary, plan: string) {
  const money = (c: number) => formatMoney(c, s.currencyCode);
  const headline =
    s.wonCents > 0
      ? `${money(s.wonCents)} recovered`
      : s.answered > 0
        ? `${plural(s.answered, "dispute")} answered`
        : `${plural(s.opened, "new dispute")}`;
  const subject = `StorePilot in ${month}: ${headline}`;
  const lines = [
    `Hi ${shopName},`,
    "",
    `Here's what happened with your Shopify Payments disputes in ${month}.`,
    "",
    `- New disputes: ${s.opened}${s.opened ? ` (${money(s.openedCents)})` : ""}`,
    `- Responses sent to the bank: ${s.answered}`,
    `- Won: ${s.won}${s.won ? ` (${money(s.wonCents)} back in your account)` : ""}`,
    `- Lost: ${s.lost}`,
  ];
  if (s.unanswered) {
    lines.push(
      "",
      `${plural(s.unanswered, "dispute")} (${money(s.unansweredCents)}) closed as lost without a response.` +
        (planFor(plan).deadlineAlerts
          ? " Deadline alerts are on, so check that the alert address in Settings is one you read."
          : " Growth and Pro send an email when a dispute arrives and again before its deadline, so this doesn't happen again."),
    );
  }
  if (s.openNow) {
    lines.push("", `${plural(s.openNow, "dispute")} still ${s.openNow === 1 ? "needs" : "need"} a response: ${adminAppUrl(shopDomain)}`);
  }
  lines.push("", "You can turn these monthly emails off in StorePilot settings.");
  return { subject, text: lines.join("\n") };
}

export interface SummaryRunResult {
  skipped?: string;
  emails: number;
  quiet: number;
  failures: number;
}

export async function runMonthlySummaries(now = new Date()): Promise<SummaryRunResult> {
  const result: SummaryRunResult = { emails: 0, quiet: 0, failures: 0 };
  if (!emailConfigured()) return { ...result, skipped: "email not configured" };
  const month = previousMonth(now);

  const shops = await prisma.shop.findMany({
    where: {
      uninstalledAt: null,
      isDemo: false,
      monthlySummary: true,
      installedAt: { lt: month.end },
      OR: [{ summaryMonth: null }, { summaryMonth: { lt: month.key } }],
    },
  });
  for (const shop of shops) {
    const to = (shop.alertEmail ?? shop.email ?? "").trim();
    const s = await summarize(shop.id, shop.currencyCode, month.start, month.end);
    if (!to || isQuiet(s)) {
      result.quiet++;
      await prisma.shop.update({ where: { id: shop.id }, data: { summaryMonth: month.key } });
      continue;
    }
    const { subject, text } = summaryEmail(shop.name ?? shop.domain, shop.domain, month.label, s, shop.plan);
    const sent = await sendEmail({ to, subject, text });
    if (!sent.sent) {
      result.failures++;
      console.warn(`[summary] ${shop.domain}: ${sent.reason}`);
      continue;
    }
    result.emails++;
    await prisma.shop.update({ where: { id: shop.id }, data: { summaryMonth: month.key } });
    await logActivity(shop.id, "alerted", `Emailed the ${month.label} summary to ${to}.`, { actor: "system" });
  }
  return result;
}
