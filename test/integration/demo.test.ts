import { beforeEach, expect, it } from "vitest";
import { demoContext, resetDemo, simulateBankDecisions, simulateNewDispute } from "../../app/lib/demo/demo.server";
import { sendToShopify } from "../../app/lib/disputes/pack.server";
import { draftView, latestDraft } from "../../app/lib/disputes/records.server";
import { prisma, resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await resetDemo();
});

it("seeds a lived-in demo store once, even with concurrent first requests", async () => {
  const [a, b] = await Promise.all([demoContext(), demoContext()]);
  expect(a.shop.id).toBe(b.shop.id);
  expect(a.shop.isDemo).toBe(true);
  expect(await prisma.dispute.count()).toBe(10);
  expect(await prisma.dispute.count({ where: { score: { not: null } } })).toBe(8);
  expect(await prisma.evidenceDraft.count()).toBe(2);
});

it("never calls Claude in the demo unless DEMO_AI=on", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
  try {
    await demoContext();
    const drafts = await prisma.evidenceDraft.findMany();
    expect(drafts.every((d) => d.source === "TEMPLATE")).toBe(true);
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

it("plays a full loop: new dispute, submit, bank decides", async () => {
  const ctx = await demoContext();
  const id = await simulateNewDispute(ctx);
  const row = await prisma.dispute.findUniqueOrThrow({ where: { id } });
  expect(row.status).toBe("NEEDS_RESPONSE");

  const { draftEvidence } = await import("../../app/lib/disputes/pack.server");
  await draftEvidence(ctx, id);
  const fields = draftView((await latestDraft(id))!).fields;
  await sendToShopify(ctx, id, fields, { submit: true });
  expect(await simulateBankDecisions(ctx)).toBe(1);
  const decided = await prisma.dispute.findUniqueOrThrow({ where: { id } });
  expect(decided.status).toBe("WON");
});
