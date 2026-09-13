// Install StorePilot on a (fake) shop and work a dispute end to end, through
// the real route modules and the real Shopify auth/webhook/billing code.
import { describe, expect, it } from "vitest";
import prisma from "../../app/db.server";
import * as appLayout from "../../app/routes/app";
import * as inbox from "../../app/routes/app._index";
import * as detail from "../../app/routes/app.disputes.$id";
import * as settings from "../../app/routes/app.settings";
import * as billingRoute from "../../app/routes/app.billing";
import * as exportRoute from "../../app/routes/app.settings.export.$id";
import * as disputesHook from "../../app/routes/webhooks.disputes";
import * as complianceHook from "../../app/routes/webhooks.compliance";
import * as uninstalledHook from "../../app/routes/webhooks.app.uninstalled";
import * as subscriptionsHook from "../../app/routes/webhooks.app_subscriptions.update";
import { incomingDemoDispute } from "../../app/lib/demo/fixtures";
import { webhookPayloadFor } from "../../app/lib/demo/mock-admin";
import { PLAN_GROWTH } from "../../app/lib/billing/plan-names";
import { APP_URL, appRequest, sessionToken, webhookRequest } from "./fake-shopify";

const SHOP = "e2e-outfitters.myshopify.com";
const fake = () => globalThis.fakeShopify;
const args = (request: Request, params: Record<string, string> = {}) =>
  ({ request, params, context: {} }) as never;

async function run<T>(fn: (a: never) => Promise<T>, request: Request, params?: Record<string, string>): Promise<T> {
  try {
    return await fn(args(request, params));
  } catch (thrown) {
    if (thrown instanceof Response) {
      throw new Error(`route threw ${thrown.status} ${thrown.headers.get("Location") ?? ""} ${await thrown.text()}`);
    }
    throw thrown;
  }
}

describe("install → dispute → submit → outcome → uninstall", () => {
  let disputeId = "";

  it("installs through token exchange and syncs the store", async () => {
    const host = Buffer.from("admin.shopify.com/store/e2e-outfitters").toString("base64url");
    const url = `${APP_URL}/app?embedded=1&shop=${SHOP}&host=${host}&id_token=${sessionToken(SHOP)}`;
    const layout = await run(appLayout.loader, new Request(url));
    expect(layout).toEqual({ apiKey: "e2e-client-id" });

    expect(fake().tokenExchanges).toBe(1);
    const session = await prisma.session.findFirstOrThrow({ where: { shop: SHOP } });
    expect(session.isOnline).toBe(false);
    expect(session.refreshToken).toBeTruthy(); // expiring offline tokens

    const shop = await prisma.shop.findUniqueOrThrow({ where: { domain: SHOP } });
    expect(shop.name).toBe("Juniper Trail Outfitters");
    expect(await prisma.dispute.count({ where: { shopId: shop.id } })).toBe(10);
    expect(fake().webhooks.map((w) => w.topic).sort()).toEqual([
      "APP_SUBSCRIPTIONS_UPDATE",
      "APP_UNINSTALLED",
      "DISPUTES_CREATE",
      "DISPUTES_UPDATE",
    ]);
    expect(fake().webhooks.every((w) => w.callbackUrl.startsWith(APP_URL))).toBe(true);
  });

  it("rejects a session token signed with the wrong secret", async () => {
    const req = new Request(`${APP_URL}/app`, { headers: { Authorization: `Bearer ${sessionToken(SHOP, { secret: "nope" })}` } });
    await expect(inbox.loader(args(req))).rejects.toBeInstanceOf(Response);
  });

  it("shows the inbox with the plan mirrored from Shopify billing", async () => {
    const data = await run(inbox.loader, appRequest("/app", SHOP));
    expect(data.stats.open).toBe(8);
    expect(data.stats.plan.key).toBe("free");
    expect(data.rows[0].daysLeft).toBeLessThanOrEqual(data.rows[1].daysLeft!);
    expect(fake().graphqlOps).toContain("appSubscription");
  });

  it("receives a new dispute by webhook", async () => {
    const { dispute, order } = incomingDemoDispute(new Date(), 7);
    fake().admin.addDispute(dispute, order);
    const res = await disputesHook.action(args(webhookRequest("/webhooks/disputes", "disputes/create", SHOP, webhookPayloadFor(dispute))));
    expect(res.status).toBe(200);
    const row = await prisma.dispute.findFirstOrThrow({ where: { shopifyId: dispute.id } });
    expect(row.evidenceId).toBe(dispute.disputeEvidence!.id);
    disputeId = row.id;
  });

  it("refuses a webhook with a forged signature", async () => {
    const { dispute } = incomingDemoDispute(new Date(), 8);
    const req = webhookRequest("/webhooks/disputes", "disputes/create", SHOP, webhookPayloadFor(dispute), { secret: "forged" });
    let status = 0;
    try {
      status = (await disputesHook.action(args(req))).status;
    } catch (thrown) {
      status = (thrown as Response).status;
    }
    expect(status).toBe(401);
    expect(await prisma.dispute.count({ where: { shopifyId: dispute.id } })).toBe(0);
  });

  it("builds the pack, drafts, edits and saves the response to Shopify", async () => {
    const path = `/app/disputes/${disputeId}`;
    const p = { id: disputeId };
    expect(await run(detail.action, appRequest(path, SHOP, { form: { intent: "build" } }), p)).toMatchObject({ ok: true });
    expect(await run(detail.action, appRequest(path, SHOP, { form: { intent: "draft" } }), p)).toMatchObject({ ok: true });

    const view = await run(detail.loader, appRequest(path, SHOP), p);
    expect(view.assessment?.recommendation).toBe("FIGHT");
    expect(view.drafts[0].source).toBe("TEMPLATE");
    expect(view.editable).toBe(true);

    const letter = view.drafts[0].fields.uncategorizedText + "\n\nThe customer also confirmed receipt by email on the delivery date.";
    const saved = await run(detail.action, appRequest(path, SHOP, { form: { intent: "save_shopify", uncategorizedText: letter } }), p);
    expect(saved).toMatchObject({ ok: true });
    const evidence = fake().admin.evidence.get(view.dispute.shopifyId.replace("Dispute/", "DisputeEvidence/"))!;
    expect(evidence.submitted).toBe(false);
    expect(evidence.input.uncategorizedText).toBe(letter);
  });

  it("submits once, and only once", async () => {
    const path = `/app/disputes/${disputeId}`;
    const p = { id: disputeId };
    const submitted = await run(detail.action, appRequest(path, SHOP, { form: { intent: "submit" } }), p);
    expect(submitted).toMatchObject({ ok: true });
    const again = await run(detail.action, appRequest(path, SHOP, { form: { intent: "submit" } }), p);
    expect(again).toMatchObject({ ok: false });
    const view = await run(detail.loader, appRequest(path, SHOP), p);
    expect(view.dispute.status).toBe("UNDER_REVIEW");
    expect(view.editable).toBe(false);
    expect(view.drafts[0].submittedAt).not.toBeNull();
  });

  it("records the bank's decision from disputes/update", async () => {
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    fake().admin.setStatus(row.shopifyId, "WON");
    const payload = webhookPayloadFor(fake().admin.getDispute(row.shopifyId)!);
    await disputesHook.action(args(webhookRequest("/webhooks/disputes", "disputes/update", SHOP, payload)));
    const data = await run(inbox.loader, appRequest("/app?tab=closed", SHOP));
    expect(data.rows.find((r) => r.id === disputeId)?.status).toBe("WON");
    expect(data.stats.won).toBe(2);
  });

  it("upgrades through Shopify billing approval", async () => {
    let redirected: Response | null = null;
    try {
      await billingRoute.action(args(appRequest("/app/billing", SHOP, { form: { plan: "growth" } })));
    } catch (thrown) {
      redirected = thrown as Response;
    }
    expect(redirected).toBeInstanceOf(Response);
    expect(fake().pendingCharge).toBe(PLAN_GROWTH);
    fake().approveCharge();
    await subscriptionsHook.action(
      args(webhookRequest("/webhooks/app_subscriptions/update", "app_subscriptions/update", SHOP, {
        app_subscription: { name: PLAN_GROWTH, status: "ACTIVE" },
      })),
    );
    const plans = await run(billingRoute.loader, appRequest("/app/billing", SHOP));
    expect(plans.current).toBe("growth");
  });

  it("saves settings", async () => {
    const res = await run(
      settings.action,
      appRequest("/app/settings", SHOP, {
        form: { intent: "save", supportEmail: "care@example.com", refundPolicy: "Short policy.", shippingPolicy: "", minFightAmount: "25", autoDraft: "false" },
      }),
    );
    expect(res).toMatchObject({ ok: true });
    const data = await run(settings.loader, appRequest("/app/settings", SHOP));
    expect(data.shop).toMatchObject({ supportEmail: "care@example.com", refundPolicy: "Short policy.", minFightAmount: 25 });
    const bad = await run(settings.action, appRequest("/app/settings", SHOP, { form: { intent: "save", supportEmail: "nope" } }));
    expect(bad).toMatchObject({ ok: false });
  });

  it("handles the mandatory privacy webhooks", async () => {
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    const customer = Number(row.customerId!.split("/").pop());
    const data = await complianceHook.action(
      args(webhookRequest("/webhooks/compliance", "customers/data_request", SHOP, {
        shop_domain: SHOP, customer: { id: customer }, orders_requested: [], data_request: { id: 9 },
      })),
    );
    expect(data.status).toBe(200);
    const listed = await run(settings.loader, appRequest("/app/settings", SHOP));
    const exported = await run(exportRoute.loader, appRequest(`/app/settings/export/${listed.privacy[0].id}`, SHOP), {
      id: listed.privacy[0].id,
    });
    expect(exported.headers.get("Content-Disposition")).toMatch(/attachment/);
    expect((await exported.json()).disputes).toBeGreaterThan(0);

    await complianceHook.action(
      args(webhookRequest("/webhooks/compliance", "customers/redact", SHOP, {
        shop_domain: SHOP, customer: { id: customer }, orders_to_redact: [],
      })),
    );
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } })).redactedAt).not.toBeNull();
  });

  it("uninstalls, then forgets the shop on shop/redact", async () => {
    await uninstalledHook.action(args(webhookRequest("/webhooks/app/uninstalled", "app/uninstalled", SHOP, { domain: SHOP })));
    expect(await prisma.session.count({ where: { shop: SHOP } })).toBe(0);
    expect((await prisma.shop.findUniqueOrThrow({ where: { domain: SHOP } })).uninstalledAt).not.toBeNull();

    await complianceHook.action(args(webhookRequest("/webhooks/compliance", "shop/redact", SHOP, { shop_domain: SHOP })));
    expect(await prisma.shop.count({ where: { domain: SHOP } })).toBe(0);
    expect(await prisma.dispute.count()).toBe(0);
  });
});
