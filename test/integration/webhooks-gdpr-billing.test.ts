import { beforeEach, describe, expect, it } from "vitest";
import { handleSubscriptionWebhook, planFromSubscriptions } from "../../app/lib/billing/billing.server";
import { PLAN_GROWTH, PLAN_PRO } from "../../app/lib/billing/plan-names";
import { handleDisputeWebhook, syncDisputes } from "../../app/lib/disputes/sync.server";
import { buildPack, draftEvidence } from "../../app/lib/disputes/pack.server";
import { incomingDemoDispute } from "../../app/lib/demo/fixtures";
import { webhookPayloadFor } from "../../app/lib/demo/mock-admin";
import { handleCompliance, scrubSnapshot } from "../../app/lib/gdpr.server";
import { markUninstalled, onInstalled } from "../../app/lib/shop.server";
import { snapshotOf } from "../../app/lib/disputes/records.server";
import { prisma, resetDb } from "../helpers/db";
import { makeStore, NOW } from "../helpers/store";

beforeEach(resetDb);

describe("dispute webhooks", () => {
  it("creates the dispute, reading the evidence id over GraphQL", async () => {
    const ctx = await makeStore();
    const { dispute, order } = incomingDemoDispute(NOW, 1);
    ctx.admin.addDispute(dispute, order);
    const r = await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
    expect(r.created).toBe(true);
    expect(r.row.evidenceId).toBe(dispute.disputeEvidence!.id);
    expect(r.row.reason).toBe("PRODUCT_NOT_RECEIVED");
    expect(ctx.admin.calls.map((c) => c.operation)).toContain("StorePilotDispute");
    // Free plan: no auto-draft.
    expect(await prisma.evidenceDraft.count()).toBe(0);
  });

  it("falls back to the payload when the GraphQL read fails", async () => {
    const ctx = await makeStore();
    const { dispute } = incomingDemoDispute(NOW, 2); // not added to the mock: dispute() returns null
    const r = await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
    expect(r.row.amountCents).toBe(18900);
    expect(r.row.orderId).toBe(dispute.order!.id);
  });

  it("drafts on arrival on Pro", async () => {
    const ctx = await makeStore({ plan: "pro" });
    const { dispute, order } = incomingDemoDispute(NOW, 3);
    ctx.admin.addDispute(dispute, order);
    const r = await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: r.row.id }, include: { drafts: true } });
    expect(row.score).not.toBeNull();
    expect(row.drafts).toHaveLength(1);
  });

  it("is idempotent and records the outcome on update", async () => {
    const ctx = await makeStore();
    const { dispute, order } = incomingDemoDispute(NOW, 4);
    ctx.admin.addDispute(dispute, order);
    await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
    await handleDisputeWebhook(ctx, webhookPayloadFor(dispute));
    expect(await prisma.dispute.count()).toBe(1);
    ctx.admin.setStatus(dispute.id, "LOST");
    const r = await handleDisputeWebhook(ctx, webhookPayloadFor(ctx.admin.getDispute(dispute.id)!));
    expect(r.statusChanged).toBe(true);
    expect(r.row.status).toBe("LOST");
    expect(r.row.finalizedOn).not.toBeNull();
  });
});

describe("install and uninstall", () => {
  it("creates the shop, reads its details and syncs once", async () => {
    const ctx = await makeStore({ domain: "unused.myshopify.com" });
    const shop = await onInstalled("fresh.myshopify.com", ctx.admin);
    expect(shop.name).toBe("Juniper Trail Outfitters");
    expect(shop.refundPolicy).toMatch(/30 days/);
    expect(await prisma.dispute.count({ where: { shopId: shop.id } })).toBe(10);
    // Re-auth doesn't resync.
    const calls = ctx.admin.calls.length;
    await onInstalled("fresh.myshopify.com", ctx.admin);
    expect(ctx.admin.calls.filter((c, i) => i >= calls && c.operation === "StorePilotDisputes")).toHaveLength(0);
  });

  it("drops sessions on uninstall but keeps data until shop/redact", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    await prisma.session.create({ data: { id: "offline_x", shop: ctx.shop.domain, state: "", accessToken: "t" } });
    await markUninstalled(ctx.shop.domain);
    expect(await prisma.session.count()).toBe(0);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } });
    expect(shop.uninstalledAt).not.toBeNull();
    expect(await prisma.dispute.count()).toBe(10);
    // Reinstall clears the flag.
    const again = await onInstalled(ctx.shop.domain, ctx.admin);
    expect(again.uninstalledAt).toBeNull();
  });
});

describe("privacy webhooks", () => {
  async function storeWithPack() {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await prisma.dispute.findFirstOrThrow({ where: { orderName: "#1041" } });
    await draftEvidence(ctx, d.id);
    return { ctx, d: await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } }) };
  }

  it("answers a data request with everything held about the customer", async () => {
    const { ctx } = await storeWithPack();
    const req = await handleCompliance("customers/data_request", ctx.shop.domain, {
      customer: { id: 7741, email: "maya.okafor@example.com" },
      orders_requested: [5141],
      data_request: { id: 1 },
    });
    const result = JSON.parse((req as { result: string }).result);
    expect(result.disputes).toBe(1);
    expect(result.data[0].evidencePack.customer.email).toBe("maya.okafor@example.com");
    expect(result.data[0].responses).toHaveLength(1);
    // The request record itself keeps no contact details.
    const stored = await prisma.gdprRequest.findFirstOrThrow();
    expect(stored.payload).not.toContain("@");
  });

  it("scrubs the customer from packs and drafts on customers/redact", async () => {
    const { ctx, d } = await storeWithPack();
    await handleCompliance("customers/redact", ctx.shop.domain, {
      customer: { id: 7741, email: "maya.okafor@example.com" },
      orders_to_redact: [5141],
    });
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id }, include: { drafts: true } });
    expect(row.redactedAt).not.toBeNull();
    const snap = snapshotOf(row)!;
    expect(snap.customer?.email).toBeNull();
    expect(snap.shippingAddress).toBeNull();
    expect(snap.payment.browserIp).toBeNull();
    expect(snap.lineItems.length).toBeGreaterThan(0); // order facts survive
    expect(row.drafts[0].fields).not.toContain("Maya");
    await expect(buildPack(ctx, d.id)).rejects.toThrow(/erased/);
  });

  it("forgets the whole shop on shop/redact", async () => {
    const { ctx } = await storeWithPack();
    await prisma.session.create({ data: { id: "offline_y", shop: ctx.shop.domain, state: "", accessToken: "t" } });
    await handleCompliance("shop/redact", ctx.shop.domain, { shop_domain: ctx.shop.domain });
    expect(await prisma.shop.count()).toBe(0);
    expect(await prisma.dispute.count()).toBe(0);
    expect(await prisma.evidenceDraft.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.gdprRequest.count({ where: { topic: "shop/redact" } })).toBe(1);
  });

  it("accepts Shopify's upper-case topic names", async () => {
    const { ctx } = await storeWithPack();
    await handleCompliance("SHOP_REDACT", ctx.shop.domain, {});
    expect(await prisma.shop.count()).toBe(0);
  });

  it("scrubSnapshot keeps the facts about the order", () => {
    const s = scrubSnapshot({
      orderId: "o", orderName: "#1", createdAt: "", totalCents: 1, currencyCode: "USD", sourceName: null, tags: [],
      customer: { id: "c", firstName: "A", lastName: "B", email: "e@example.com", ordersCount: 2, totalSpentCents: 5, createdAt: null },
      billingAddress: { address1: "x" }, shippingAddress: { address1: "y" }, lineItems: [],
      payment: { gateway: null, cardBrand: "Visa", last4: "4242", avsResultCode: "Y", cvvResultCode: "M", browserIp: "192.0.2.1" },
      fulfillments: [], refunds: [], policies: { refund: null, shipping: null, terms: null },
    });
    expect(s.customer).toMatchObject({ firstName: null, email: null, ordersCount: 2 });
    expect(s.payment).toMatchObject({ avsResultCode: "Y", browserIp: null });
  });
});

describe("billing", () => {
  it("picks the best active plan", () => {
    expect(planFromSubscriptions([])).toBe("free");
    expect(planFromSubscriptions([{ name: PLAN_GROWTH, status: "ACTIVE" }])).toBe("growth");
    expect(planFromSubscriptions([{ name: PLAN_GROWTH, status: "ACTIVE" }, { name: PLAN_PRO, status: "ACTIVE" }])).toBe("pro");
    expect(planFromSubscriptions([{ name: PLAN_PRO, status: "CANCELLED" }])).toBe("free");
  });

  it("follows app_subscriptions/update", async () => {
    const ctx = await makeStore();
    let shop = await handleSubscriptionWebhook(ctx.shop.domain, { app_subscription: { name: PLAN_PRO, status: "ACTIVE" } });
    expect(shop?.plan).toBe("pro");
    // A cancelled Growth subscription doesn't downgrade a Pro shop.
    shop = await handleSubscriptionWebhook(ctx.shop.domain, { app_subscription: { name: PLAN_GROWTH, status: "CANCELLED" } });
    expect(shop?.plan).toBe("pro");
    shop = await handleSubscriptionWebhook(ctx.shop.domain, { app_subscription: { name: PLAN_PRO, status: "FROZEN" } });
    expect(shop?.plan).toBe("free");
    expect(await prisma.activity.count({ where: { kind: "plan_changed" } })).toBe(2);
  });
});
