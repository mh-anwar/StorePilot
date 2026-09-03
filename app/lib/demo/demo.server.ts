// The demo store: a real StoreContext backed by seeded rows in the database
// and MockShopifyAdmin instead of a Shopify store. Every code path (sync,
// packs, drafts, saving and submitting evidence, webhooks) is the production
// one; only the AdminClient differs.

import prisma from "../../db.server";
import type { StoreContext } from "../context.server";
import { buildPack, draftEvidence } from "../disputes/pack.server";
import { handleDisputeWebhook, syncDisputes } from "../disputes/sync.server";
import { refreshShopDetails } from "../shop.server";
import { DEMO_SHOP_DOMAIN, incomingDemoDispute } from "./fixtures";
import { MockShopifyAdmin, webhookPayloadFor } from "./mock-admin";

const g = globalThis as unknown as { __storepilotDemo?: { admin: MockShopifyAdmin; seq: number } };

function state() {
  g.__storepilotDemo ??= { admin: new MockShopifyAdmin(), seq: 0 };
  return g.__storepilotDemo;
}

export function demoEnabled(): boolean {
  return process.env.DEMO_MODE !== "off";
}

/** Demo data older than this is thrown away so deadlines stay in the future. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export async function demoContext(): Promise<StoreContext> {
  if (!demoEnabled()) throw new Response("Demo is disabled on this server", { status: 404 });
  let shop = await prisma.shop.findUnique({ where: { domain: DEMO_SHOP_DOMAIN } });
  const hasState = Boolean(g.__storepilotDemo);
  if (shop && (!hasState || Date.now() - shop.installedAt.getTime() > MAX_AGE_MS)) {
    // The process restarted (mock state is gone) or the data is stale.
    await prisma.shop.delete({ where: { id: shop.id } });
    g.__storepilotDemo = undefined;
    shop = null;
  }
  const { admin } = state();
  if (shop) return { shop, admin, actor: "demo@storepilot.app", isDemo: true };
  // Two first requests at once must not both seed.
  seeding ??= seedDemo(admin).finally(() => {
    seeding = null;
  });
  return seeding;
}

let seeding: Promise<StoreContext> | null = null;

async function seedDemo(admin: MockShopifyAdmin): Promise<StoreContext> {
  const shop = await prisma.shop.create({
    data: { domain: DEMO_SHOP_DOMAIN, isDemo: true, plan: "growth", minFightAmountCents: 4000 },
  });
  const ctx: StoreContext = { shop, admin, actor: "demo@storepilot.app", isDemo: true };
  ctx.shop = await refreshShopDetails(shop, admin);
  await syncDisputes(ctx);
  // Make the inbox look lived in: packs for most open disputes, drafts for two.
  const open = await prisma.dispute.findMany({
    where: { shopId: shop.id, status: "NEEDS_RESPONSE" },
    orderBy: { evidenceDueBy: "asc" },
  });
  for (const [i, d] of open.entries()) {
    if (i >= 6) break;
    await buildPack(ctx, d.id);
    if (i < 2) await draftEvidence(ctx, d.id);
  }
  return ctx;
}

export async function resetDemo() {
  await prisma.shop.deleteMany({ where: { domain: DEMO_SHOP_DOMAIN } });
  g.__storepilotDemo = undefined;
}

/** Runs the real disputes/create webhook handler with a new dispute. */
export async function simulateNewDispute(ctx: StoreContext) {
  const s = state();
  s.seq += 1;
  const { dispute, order } = incomingDemoDispute(new Date(), s.seq);
  s.admin.addDispute(dispute, order);
  const result = await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
  return result.row.id;
}

/** Simulates the bank deciding every submitted dispute, then runs disputes/update. */
export async function simulateBankDecisions(ctx: StoreContext) {
  const s = state();
  const submitted = await prisma.dispute.findMany({ where: { shopId: ctx.shop.id, status: "UNDER_REVIEW" } });
  for (const d of submitted) {
    // Strong packs win; the demo shouldn't pretend weak ones do.
    const outcome = (d.score ?? 0) >= 50 ? "WON" : "LOST";
    s.admin.setStatus(d.shopifyId, outcome);
    await handleDisputeWebhook(ctx, webhookPayloadFor(s.admin.getDispute(d.shopifyId)!));
  }
  return submitted.length;
}
