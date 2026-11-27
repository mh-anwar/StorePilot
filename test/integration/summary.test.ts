// Monthly summary emails: content from last month's disputes, once per month,
// quiet months skipped, opt-out respected, failures retried.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEmailTransport, type EmailMessage } from "../../app/lib/alerts/email.server";
import { previousMonth, runMonthlySummaries } from "../../app/lib/alerts/summary.server";
import { syncDisputes } from "../../app/lib/disputes/sync.server";
import { prisma, resetDb } from "../helpers/db";
import { makeStore } from "../helpers/store";

// Fixed clock: the run on Jan 3 2031 summarizes December 2030.
const RUN_AT = new Date(Date.UTC(2031, 0, 3, 9));
const dec = (day: number) => new Date(Date.UTC(2030, 11, day, 12));

let outbox: EmailMessage[] = [];
beforeEach(async () => {
  await resetDb();
  outbox = [];
  setEmailTransport(async (m) => {
    outbox.push(m);
    return { sent: true };
  });
});
afterEach(() => setEmailTransport(null));

async function storeWithDecember(plan: string, domain = "test-store.myshopify.com") {
  const ctx = await makeStore({ plan, domain });
  await prisma.shop.update({ where: { id: ctx.shop.id }, data: { email: "owner@example.com", installedAt: dec(1) } });
  await syncDisputes(ctx);
  // Move a few fixture disputes into December so the month has activity.
  const won = await prisma.dispute.findFirstOrThrow({ where: { shopId: ctx.shop.id, status: "WON" } });
  const lost = await prisma.dispute.findFirstOrThrow({ where: { shopId: ctx.shop.id, status: "LOST" } });
  const open = await prisma.dispute.findFirstOrThrow({ where: { shopId: ctx.shop.id, status: "NEEDS_RESPONSE" } });
  await prisma.dispute.update({ where: { id: won.id }, data: { finalizedOn: dec(10) } });
  await prisma.dispute.update({ where: { id: lost.id }, data: { finalizedOn: dec(15), evidenceSentOn: null } });
  await prisma.dispute.update({ where: { id: open.id }, data: { initiatedAt: dec(12) } });
  return { ctx, won, lost, open };
}

describe("monthly summary", () => {
  it("names the month and the money recovered, and sends once", async () => {
    expect(previousMonth(RUN_AT)).toMatchObject({ key: "2030-12", label: "December 2030" });
    const { ctx } = await storeWithDecember("growth");

    expect(await runMonthlySummaries(RUN_AT)).toMatchObject({ emails: 1, failures: 0 });
    expect(outbox[0].to).toBe("owner@example.com");
    expect(outbox[0].subject).toBe("StorePilot in December 2030: $264.00 recovered");
    expect(outbox[0].text).toContain("- New disputes: 1");
    expect(outbox[0].text).toContain("- Won: 1 ($264.00 back in your account)");
    expect(outbox[0].text).toMatch(/closed as lost without a response\. Deadline alerts are on/);
    expect(outbox[0].text).toMatch(/still need a response/);
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } })).summaryMonth).toBe("2030-12");

    expect(await runMonthlySummaries(RUN_AT)).toMatchObject({ emails: 0 });
    expect(outbox).toHaveLength(1);
  });

  it("tells Free stores how alerts would have helped", async () => {
    await storeWithDecember("free");
    await runMonthlySummaries(RUN_AT);
    expect(outbox[0].text).toMatch(/Growth and Pro send an email when a dispute arrives/);
  });

  it("skips quiet months and stores that opted out, and retries failed sends", async () => {
    const quiet = await makeStore({ domain: "quiet.myshopify.com" });
    await prisma.shop.update({ where: { id: quiet.shop.id }, data: { email: "q@example.com", installedAt: dec(1) } });
    const { ctx } = await storeWithDecember("growth");
    await prisma.shop.update({ where: { id: ctx.shop.id }, data: { monthlySummary: false } });
    expect(await runMonthlySummaries(RUN_AT)).toMatchObject({ emails: 0, quiet: 1 });
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: quiet.shop.id } })).summaryMonth).toBe("2030-12");

    await prisma.shop.update({ where: { id: ctx.shop.id }, data: { monthlySummary: true } });
    setEmailTransport(async () => ({ sent: false, reason: "down" }));
    expect(await runMonthlySummaries(RUN_AT)).toMatchObject({ emails: 0, failures: 1 });
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } })).summaryMonth).toBeNull();
  });

  it("doesn't summarize a month the store hadn't installed in yet", async () => {
    const { ctx } = await storeWithDecember("growth");
    await prisma.shop.update({ where: { id: ctx.shop.id }, data: { installedAt: new Date(Date.UTC(2031, 0, 2)) } });
    expect(await runMonthlySummaries(RUN_AT)).toMatchObject({ emails: 0 });
  });
});
