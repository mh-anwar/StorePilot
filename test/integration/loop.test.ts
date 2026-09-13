// The whole dispute loop against the mock Admin API: sync, pack, draft, edit,
// save to Shopify, submit, and the rules around each step.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlanLimitError, UserFacingError } from "../../app/lib/errors";
import { buildPack, decide, draftEvidence, saveEdits, sendToShopify } from "../../app/lib/disputes/pack.server";
import { syncDisputes } from "../../app/lib/disputes/sync.server";
import { packsUsed, draftView, latestDraft } from "../../app/lib/disputes/records.server";
import { dashboardStats, disputeDetail, listDisputes } from "../../app/lib/disputes/views.server";
import { setAnthropicClient, type MessagesClient } from "../../app/lib/disputes/draft/ai.server";
import { prisma, resetDb } from "../helpers/db";
import { makeStore } from "../helpers/store";

beforeEach(resetDb);
afterEach(() => {
  setAnthropicClient(null);
  delete process.env.ANTHROPIC_API_KEY;
});

async function byOrder(shopId: string, orderName: string) {
  return prisma.dispute.findFirstOrThrow({ where: { shopId, orderName } });
}

describe("sync", () => {
  it("imports every dispute across pages and is idempotent", async () => {
    const ctx = await makeStore();
    const first = await syncDisputes(ctx);
    expect(first).toMatchObject({ total: 10, created: 10, updated: 0 });
    const again = await syncDisputes(ctx);
    expect(again).toMatchObject({ total: 10, created: 0, updated: 0 });
    expect(await prisma.dispute.count({ where: { shopId: ctx.shop.id } })).toBe(10);
    const row = await byOrder(ctx.shop.id, "#1041");
    expect(row.evidenceId).toBe("gid://shopify/ShopifyPaymentsDisputeEvidence/901");
    expect(row.amountCents).toBe(31800);
  });

  it("records outcome changes in the activity log", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    ctx.admin.setStatus("gid://shopify/ShopifyPaymentsDispute/901", "WON");
    const r = await syncDisputes(ctx);
    expect(r.updated).toBe(1);
    const outcome = await prisma.activity.findFirst({ where: { shopId: ctx.shop.id, kind: "outcome" } });
    expect(outcome?.message).toMatch(/won/);
  });
});

describe("evidence packs", () => {
  it("builds a pack, scores it, and charges the allowance once", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1041");
    const { assessment, snapshot } = await buildPack(ctx, d.id);
    expect(assessment.recommendation).toBe("FIGHT");
    expect(snapshot.fulfillments[0].trackingCompany).toBe("UPS");
    expect(snapshot.policies.refund).toMatch(/30 days/);
    await buildPack(ctx, d.id); // rebuild is free
    expect(await packsUsed(ctx.shop.id)).toBe(1);
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.customerId).toBe("gid://shopify/Customer/7741");
  });

  it("recommends accepting a weak, small fraud claim", async () => {
    const ctx = await makeStore({ minFightAmountCents: 4000 });
    await syncDisputes(ctx);
    const { assessment } = await buildPack(ctx, (await byOrder(ctx.shop.id, "#1047")).id);
    expect(assessment.recommendation).toBe("ACCEPT");
  });

  it("stops at the Free plan's three packs a month", async () => {
    const ctx = await makeStore({ plan: "free" });
    await syncDisputes(ctx);
    const open = await prisma.dispute.findMany({ where: { shopId: ctx.shop.id, status: "NEEDS_RESPONSE" } });
    for (const d of open.slice(0, 3)) await buildPack(ctx, d.id);
    await expect(buildPack(ctx, open[3].id)).rejects.toBeInstanceOf(PlanLimitError);
    // Rebuilding one of the first three still works.
    await expect(buildPack(ctx, open[0].id)).resolves.toBeTruthy();
  });

  it("uses the merchant's edited policy over the store's", async () => {
    const ctx = await makeStore();
    ctx.shop = await prisma.shop.update({ where: { id: ctx.shop.id }, data: { refundPolicy: "Custom refund terms." } });
    await syncDisputes(ctx);
    const { snapshot } = await buildPack(ctx, (await byOrder(ctx.shop.id, "#1038")).id);
    expect(snapshot.policies.refund).toBe("Custom refund terms.");
  });

  it("refuses disputes from another shop", async () => {
    const a = await makeStore({ domain: "a.myshopify.com" });
    const b = await makeStore({ domain: "b.myshopify.com" });
    await syncDisputes(a);
    const d = await byOrder(a.shop.id, "#1041");
    await expect(buildPack(b, d.id)).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe("drafting", () => {
  it("drafts from the template on the Free plan", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1044");
    const draft = await draftEvidence(ctx, d.id); // builds the pack on the way
    expect(draft.source).toBe("TEMPLATE");
    const view = draftView(draft);
    expect(view.fields.uncategorizedText).toContain("#1044");
    expect(view.fields.accessActivityLog).toContain("AVS");
  });

  it("drafts with Claude on Growth when a key is configured, and falls back on failure", async () => {
    const ctx = await makeStore({ plan: "growth" });
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1041");
    let calls = 0;
    const fake: MessagesClient = {
      beta: {
        messages: {
          parse: (async (body: { model: string }) => {
            calls++;
            if (calls > 1) throw new Error("boom");
            return {
              model: body.model,
              stop_reason: "end_turn",
              parsed_output: {
                rebuttalLetter: "Order #1041 was delivered by UPS on the date shown in the tracking record.",
                accessActivityLog: null,
                refundPolicyDisclosure: null,
                refundRefusalExplanation: null,
                cancellationPolicyDisclosure: null,
                cancellationRebuttal: null,
                shippingAddress: null,
                merchantNotes: ["Attach the UPS delivery photo if you have it."],
              },
            };
          }) as unknown as MessagesClient["beta"]["messages"]["parse"],
        },
      },
    };
    setAnthropicClient(fake);
    const ai = await draftEvidence(ctx, d.id);
    expect(ai.source).toBe("AI");
    expect(ai.model).toBe("claude-haiku-5-5");
    expect(draftView(ai).notes).toEqual(["Attach the UPS delivery photo if you have it."]);
    expect(draftView(ai).fields.customerEmailAddress).toBe("maya.okafor@example.com");
    const fallback = await draftEvidence(ctx, d.id);
    expect(fallback.source).toBe("TEMPLATE");
    expect(fallback.version).toBe(2);
  });
});

describe("saving and submitting", () => {
  it("only versions real edits", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1041");
    const v1 = draftView(await draftEvidence(ctx, d.id));
    const same = await saveEdits(ctx, d.id, v1.fields);
    expect(same.version).toBe(1);
    const edited = await saveEdits(ctx, d.id, { ...v1.fields, uncategorizedText: "Edited letter." });
    expect(edited.version).toBe(2);
    expect(edited.source).toBe("MERCHANT");
  });

  it("saves to Shopify without submitting, then submits exactly once", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1041");
    const fields = draftView(await draftEvidence(ctx, d.id)).fields;

    const saved = await sendToShopify(ctx, d.id, fields, { submit: false });
    expect(saved.submitted).toBe(false);
    const stored = ctx.admin.evidence.get(d.evidenceId!)!;
    expect(stored.submitted).toBe(false);
    expect(stored.input.uncategorizedText).toBe(fields.uncategorizedText);
    expect(stored.input.shippingAddress).toMatchObject({ city: "Portland", provinceCode: "OR", countryCode: "US" });

    const submitted = await sendToShopify(ctx, d.id, { ...fields, uncategorizedText: "Final letter." }, { submit: true });
    expect(submitted).toEqual({ submitted: true, version: 2 });
    expect(ctx.admin.evidence.get(d.evidenceId!)!.submitted).toBe(true);
    const row = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.status).toBe("UNDER_REVIEW");
    expect(row.evidenceSentOn).not.toBeNull();
    const latest = draftView((await latestDraft(d.id))!);
    expect(latest.submittedAt).not.toBeNull();

    await expect(sendToShopify(ctx, d.id, fields, { submit: true })).rejects.toThrow(/already submitted/);
    const detail = await disputeDetail(ctx, d.id);
    expect(detail.editable).toBe(false);
  });

  it("surfaces Shopify's userErrors", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const d = await byOrder(ctx.shop.id, "#1041");
    await prisma.dispute.update({ where: { id: d.id }, data: { evidenceId: "gid://shopify/ShopifyPaymentsDisputeEvidence/0" } });
    await expect(sendToShopify(ctx, d.id, { uncategorizedText: "x" }, { submit: false })).rejects.toThrow(/not found/);
    expect(await prisma.activity.count({ where: { kind: "error" } })).toBe(1);
  });

  it("won't submit without a letter, after the deadline, or on closed disputes", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const open = await byOrder(ctx.shop.id, "#1041");
    await expect(sendToShopify(ctx, open.id, {}, { submit: true })).rejects.toThrow(/rebuttal letter/);
    await prisma.dispute.update({ where: { id: open.id }, data: { evidenceDueBy: new Date(Date.now() - 1000) } });
    await expect(sendToShopify(ctx, open.id, { uncategorizedText: "x" }, { submit: true })).rejects.toThrow(/deadline/);
    const won = await byOrder(ctx.shop.id, "#1022");
    await expect(sendToShopify(ctx, won.id, { uncategorizedText: "x" }, { submit: true })).rejects.toThrow();
  });

  it("records an accept decision and keeps it out of the due-soon count", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const before = await dashboardStats(ctx);
    const urgent = (await listDisputes(ctx, "open")).filter((r) => r.daysLeft !== null && r.daysLeft <= 3);
    expect(before.dueSoon).toBe(urgent.length);
    await decide(ctx, urgent[0].id, "ACCEPT");
    const after = await dashboardStats(ctx);
    expect(after.dueSoon).toBe(before.dueSoon - 1);
  });
});

describe("dashboard", () => {
  it("adds up money at stake, recovered and the win rate", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const s = await dashboardStats(ctx);
    expect(s.open).toBe(8);
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.winRate).toBe(50);
    expect(s.recoveredCents).toBe(26400);
    expect(s.plan).toMatchObject({ key: "free", packsLimit: 3, packsLeft: 3 });
    expect((await listDisputes(ctx, "closed")).map((r) => r.status).sort()).toEqual(["LOST", "WON"]);
  });
});
