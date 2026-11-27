// Loader/action bodies shared by the embedded app (/app/*) and the demo
// (/demo/*). Route modules only decide where the StoreContext comes from.

import prisma from "../db.server";
import { planFor } from "./billing/plans";
import type { StoreContext } from "./context.server";
import { buildPack, decide, draftEvidence, saveEdits, sendToShopify } from "./disputes/pack.server";
import { fieldsFromForm } from "./disputes/evidence-input";
import { draftView, latestDraft } from "./disputes/records.server";
import { syncDisputes } from "./disputes/sync.server";
import { dashboardStats, disputeDetail, listDisputes, recentActivity, type InboxTab } from "./disputes/views.server";
import { aiAvailable } from "./disputes/draft/ai.server";
import { messageOf } from "./errors";
import { emailConfigured } from "./alerts/email.server";
import { privacyRequests } from "./gdpr.server";
import { shouldAskForReview } from "./onboarding";
import { refreshShopDetails } from "./shop.server";

import type { ActionResult } from "./action-result";
export type { ActionResult };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TABS: InboxTab[] = ["open", "submitted", "closed", "all"];

export async function inboxLoader(ctx: StoreContext, request: Request) {
  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab") as InboxTab | null;
  const tab = tabParam && TABS.includes(tabParam) ? tabParam : "open";
  const [stats, rows, activity] = await Promise.all([
    dashboardStats(ctx),
    listDisputes(ctx, tab),
    recentActivity(ctx),
  ]);
  return {
    shopName: ctx.shop.name ?? ctx.shop.domain,
    tab,
    stats,
    rows,
    activity,
    askForReview: shouldAskForReview({
      won: stats.won,
      reviewRequestedAt: ctx.shop.reviewRequestedAt?.toISOString() ?? null,
      isDemo: ctx.isDemo,
    }),
    setup: {
      lastSyncedAt: ctx.shop.lastSyncedAt?.toISOString() ?? null,
      supportEmail: ctx.shop.supportEmail,
      refundPolicy: ctx.shop.refundPolicy,
      shippingPolicy: ctx.shop.shippingPolicy,
      plan: planFor(ctx.shop.plan).key,
      setupDismissedAt: ctx.shop.setupDismissedAt?.toISOString() ?? null,
    },
    isDemo: ctx.isDemo,
  };
}

export async function inboxAction(ctx: StoreContext, request: Request): Promise<ActionResult> {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "sync") {
      const r = await syncDisputes(ctx);
      return { ok: true, message: `Synced ${r.total} disputes (${r.created} new, ${r.updated} changed).` };
    }
    if (intent === "review_requested") {
      ctx.shop = await prisma.shop.update({ where: { id: ctx.shop.id }, data: { reviewRequestedAt: new Date() } });
      return { ok: true, message: "" };
    }
    if (intent === "dismiss_setup" || intent === "show_setup") {
      ctx.shop = await prisma.shop.update({
        where: { id: ctx.shop.id },
        data: { setupDismissedAt: intent === "dismiss_setup" ? new Date() : null },
      });
      return { ok: true, message: intent === "dismiss_setup" ? "Setup guide hidden." : "Setup guide restored." };
    }
    return { ok: false, error: "Unknown action." };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function detailLoader(ctx: StoreContext, id: string) {
  const detail = await disputeDetail(ctx, id);
  const plan = planFor(ctx.shop.plan);
  return {
    ...detail,
    shopDomain: ctx.shop.domain,
    aiDrafts: plan.aiDrafts && aiAvailable(),
    planAllowsAi: plan.aiDrafts,
    isDemo: ctx.isDemo,
  };
}

export async function detailAction(ctx: StoreContext, id: string, request: Request): Promise<ActionResult> {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    switch (intent) {
      case "build": {
        const { assessment } = await buildPack(ctx, id);
        return { ok: true, message: `Evidence pack built: ${assessment.score}/100.` };
      }
      case "draft": {
        const draft = await draftEvidence(ctx, id);
        return { ok: true, message: `Draft v${draft.version} ready (${draft.source === "AI" ? "written by Claude" : "template"}).` };
      }
      case "save":
      case "save_shopify":
      case "submit": {
        const owned = await prisma.dispute.findFirst({ where: { id, shopId: ctx.shop.id }, select: { id: true } });
        if (!owned) return { ok: false, error: "That dispute doesn't exist in this store." };
        const current = await latestDraft(id);
        const base = current ? draftView(current).fields : {};
        const fields = fieldsFromForm(form, base);
        if (intent === "save") {
          const draft = await saveEdits(ctx, id, fields);
          return { ok: true, message: `Saved as v${draft.version}.` };
        }
        const result = await sendToShopify(ctx, id, fields, { submit: intent === "submit" });
        return {
          ok: true,
          message: result.submitted
            ? `Response v${result.version} submitted. The bank usually decides within 60-75 days.`
            : `Response v${result.version} saved to the dispute in Shopify. It has not been sent to the bank yet.`,
        };
      }
      case "accept":
        await decide(ctx, id, "ACCEPT");
        return { ok: true, message: "Marked as accepted." };
      case "fight":
        await decide(ctx, id, "FIGHT");
        return { ok: true, message: "Marked to fight." };
      case "undecide":
        await decide(ctx, id, null);
        return { ok: true, message: "Decision cleared." };
      default:
        return { ok: false, error: "Unknown action." };
    }
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function settingsLoader(ctx: StoreContext) {
  return {
    shop: {
      domain: ctx.shop.domain,
      name: ctx.shop.name,
      supportEmail: ctx.shop.supportEmail ?? "",
      refundPolicy: ctx.shop.refundPolicy ?? "",
      shippingPolicy: ctx.shop.shippingPolicy ?? "",
      autoDraft: ctx.shop.autoDraft,
      minFightAmount: ctx.shop.minFightAmountCents / 100,
      deadlineAlerts: ctx.shop.deadlineAlerts,
      alertEmail: ctx.shop.alertEmail ?? "",
      ownerEmail: ctx.shop.email ?? "",
      currencyCode: ctx.shop.currencyCode,
      lastSyncedAt: ctx.shop.lastSyncedAt?.toISOString() ?? null,
    },
    plan: planFor(ctx.shop.plan).key,
    planHasAlerts: planFor(ctx.shop.plan).deadlineAlerts,
    emailConfigured: emailConfigured(),
    aiConfigured: aiAvailable(),
    privacy: await privacyRequests(ctx.shop.domain),
    isDemo: ctx.isDemo,
  };
}

export async function settingsAction(ctx: StoreContext, request: Request): Promise<ActionResult> {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  try {
    if (intent === "reload_policies") {
      await prisma.shop.update({ where: { id: ctx.shop.id }, data: { refundPolicy: null, shippingPolicy: null } });
      const fresh = await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } });
      ctx.shop = await refreshShopDetails(fresh, ctx.admin);
      return { ok: true, message: "Policies reloaded from your store." };
    }
    const min = Number(form.get("minFightAmount") ?? 0);
    const email = String(form.get("supportEmail") ?? "").trim();
    if (email && !EMAIL_RE.test(email)) {
      return { ok: false, error: "Support email doesn't look like an email address." };
    }
    const alertEmail = String(form.get("alertEmail") ?? "").trim();
    if (alertEmail && !EMAIL_RE.test(alertEmail)) {
      return { ok: false, error: "Alert email doesn't look like an email address." };
    }
    if (!Number.isFinite(min) || min < 0 || min > 100000) {
      return { ok: false, error: "Minimum amount must be between 0 and 100,000." };
    }
    await prisma.shop.update({
      where: { id: ctx.shop.id },
      data: {
        supportEmail: email || null,
        refundPolicy: String(form.get("refundPolicy") ?? "").trim() || null,
        shippingPolicy: String(form.get("shippingPolicy") ?? "").trim() || null,
        autoDraft: form.get("autoDraft") === "on" || form.get("autoDraft") === "true",
        minFightAmountCents: Math.round(min * 100),
        // Older clients don't send these fields; leave the stored values alone then.
        ...(form.has("deadlineAlerts")
          ? { deadlineAlerts: form.get("deadlineAlerts") === "on" || form.get("deadlineAlerts") === "true" }
          : {}),
        ...(form.has("alertEmail") ? { alertEmail: alertEmail || null } : {}),
      },
    });
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

/** JSON export for a customers/data_request, for the merchant to pass on. */
export async function privacyExport(ctx: StoreContext, requestId: string) {
  const row = await prisma.gdprRequest.findFirst({
    where: { id: requestId, shopDomain: ctx.shop.domain, topic: "customers/data_request" },
  });
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(row.result ?? "{}", {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="storepilot-data-request-${row.id}.json"`,
    },
  });
}
