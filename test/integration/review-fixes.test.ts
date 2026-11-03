// Regressions for the issues an independent review found.
import { beforeEach, expect, it } from "vitest";
import { syncPlanFromShopify } from "../../app/lib/billing/billing.server";
import { PLAN_GROWTH, PLAN_PRO } from "../../app/lib/billing/plan-names";
import { draftEvidence, sendToShopify, saveEdits, decide } from "../../app/lib/disputes/pack.server";
import { draftView } from "../../app/lib/disputes/records.server";
import { handleDisputeWebhook, syncDisputes } from "../../app/lib/disputes/sync.server";
import { webhookPayloadFor } from "../../app/lib/demo/mock-admin";
import { handleCompliance } from "../../app/lib/gdpr.server";
import { onInstalled } from "../../app/lib/shop.server";
import type { AdminClient } from "../../app/lib/shopify/admin-client";
import { prisma, resetDb } from "../helpers/db";
import { makeStore } from "../helpers/store";

beforeEach(resetDb);

async function draftedDispute(orderName = "#1044") {
  const ctx = await makeStore();
  await syncDisputes(ctx);
  const d = await prisma.dispute.findFirstOrThrow({ where: { orderName } });
  const fields = draftView(await draftEvidence(ctx, d.id)).fields;
  return { ctx, d: await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } }), fields };
}

it("clearing a field clears what an earlier save stored in Shopify", async () => {
  const { ctx, d, fields } = await draftedDispute();
  expect(fields.accessActivityLog).toBeTruthy();
  await sendToShopify(ctx, d.id, fields, { submit: false });
  expect(ctx.admin.evidence.get(d.evidenceId!)!.input.accessActivityLog).toBeTruthy();
  await sendToShopify(ctx, d.id, { ...fields, accessActivityLog: undefined }, { submit: true });
  expect(ctx.admin.evidence.get(d.evidenceId!)!.input.accessActivityLog).toBe("");
});

it("doesn't mark a dispute submitted when Shopify doesn't confirm it", async () => {
  const { ctx, d, fields } = await draftedDispute();
  const unconfirming: AdminClient = {
    graphql: async <T,>(q: string, v?: Record<string, unknown>) => {
      const data = (await ctx.admin.graphql(q, v)) as Record<string, unknown>;
      if ("disputeEvidenceUpdate" in data) {
        return { disputeEvidenceUpdate: { disputeEvidence: { id: v!.id, submitted: false }, userErrors: [] } } as T;
      }
      return data as T;
    },
  };
  await expect(sendToShopify({ ...ctx, admin: unconfirming }, d.id, fields, { submit: true })).rejects.toThrow(/didn't confirm/);
  const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
  expect(row.status).toBe("NEEDS_RESPONSE");
  expect(row.evidenceSentOn).toBeNull();
});

it("a late, stale webhook payload can't reopen a submitted dispute", async () => {
  const { ctx, d, fields } = await draftedDispute();
  const stale = webhookPayloadFor(ctx.admin.getDispute(d.shopifyId)!); // still needs_response
  await sendToShopify(ctx, d.id, fields, { submit: true });
  const broken: typeof ctx = { ...ctx, admin: { ...ctx.admin, graphql: async () => { throw new Error("down"); } } as never };
  await handleDisputeWebhook(broken, stale);
  const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
  expect(row.status).toBe("UNDER_REVIEW");
  expect(row.evidenceSentOn).not.toBeNull();
});

it("customers/redact also scrubs the assessment, tracking, refund notes and the old export", async () => {
  const { ctx, d } = await draftedDispute("#1035"); // has a refund note and tracking
  await handleCompliance("customers/data_request", ctx.shop.domain, { customer: { id: 7735 }, orders_requested: [5135] });
  await handleCompliance("customers/redact", ctx.shop.domain, { customer: { id: 7735 }, orders_to_redact: [5135] });
  const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
  const everything = JSON.stringify(row) + JSON.stringify(await prisma.gdprRequest.findMany()) + JSON.stringify(await prisma.evidenceDraft.findMany());
  for (const pii of ["Sam", "Whitaker", "sam.whitaker@example.com", "192.0.2.18", "702 Pine St", "9400111899223196602177", "Returned unused"]) {
    expect(everything).not.toContain(pii);
  }
  expect(row.score).not.toBeNull(); // the facts about the case survive
});

it("erased disputes are read-only on the server, not just in the UI", async () => {
  const { ctx, d, fields } = await draftedDispute();
  await handleCompliance("customers/redact", ctx.shop.domain, { customer: { id: 7744 }, orders_to_redact: [] });
  await expect(draftEvidence(ctx, d.id)).rejects.toThrow(/erased/);
  await expect(saveEdits(ctx, d.id, fields)).rejects.toThrow(/erased/);
  await expect(sendToShopify(ctx, d.id, fields, { submit: true })).rejects.toThrow(/erased/);
  await expect(decide(ctx, d.id, "ACCEPT")).rejects.toThrow(/erased/);
});

it("subscription changes are read back from Shopify, not trusted from the event", async () => {
  const ctx = await makeStore({ plan: "pro" });
  const admin: AdminClient = {
    graphql: async <T,>() =>
      ({ currentAppInstallation: { activeSubscriptions: [{ id: "2", name: PLAN_GROWTH, status: "ACTIVE" }] } }) as T,
  };
  expect((await syncPlanFromShopify(ctx.shop.domain, admin))?.plan).toBe("growth");
  const none: AdminClient = { graphql: async <T,>() => ({ currentAppInstallation: { activeSubscriptions: [] } }) as T };
  expect((await syncPlanFromShopify(ctx.shop.domain, none))?.plan).toBe("free");
  void PLAN_PRO;
});

it("a real store can't take the demo's domain", async () => {
  const ctx = await makeStore();
  await expect(onInstalled("storepilot-demo.myshopify.com", ctx.admin)).rejects.toThrow(/Reserved/);
});
