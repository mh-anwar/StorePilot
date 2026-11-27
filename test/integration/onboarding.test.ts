// First-run: the setup guide's inputs, hiding/restoring it, and the
// "lost without a response" number on the home page.
import { beforeEach, describe, expect, it } from "vitest";
import { inboxAction, inboxLoader } from "../../app/lib/handlers.server";
import { syncDisputes } from "../../app/lib/disputes/sync.server";
import { dashboardStats } from "../../app/lib/disputes/views.server";
import { setupGuide } from "../../app/lib/onboarding";
import { prisma, resetDb } from "../helpers/db";
import { makeStore } from "../helpers/store";

beforeEach(resetDb);

function post(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request("http://app.test/app", { method: "POST", body });
}

describe("setup guide", () => {
  it("reflects the shop: sync done after import, policies still missing", async () => {
    const ctx = await makeStore();
    const before = await inboxLoader(ctx, new Request("http://app.test/app"));
    expect(before.setup).toMatchObject({ lastSyncedAt: null, plan: "free", setupDismissedAt: null });
    expect(setupGuide(before.setup, "/app").steps.find((s) => s.id === "sync")?.done).toBe(false);

    await syncDisputes(ctx);
    const after = await inboxLoader(ctx, new Request("http://app.test/app"));
    const guide = setupGuide(after.setup, "/app");
    expect(guide.steps.find((s) => s.id === "sync")?.done).toBe(true);
    expect(guide.steps.find((s) => s.id === "contact")?.done).toBe(true); // test store has an email
    expect(guide.steps.find((s) => s.id === "policies")?.done).toBe(false);
    expect(guide.visible).toBe(true);
  });

  it("can be hidden and brought back, per shop", async () => {
    const ctx = await makeStore();
    const other = await makeStore({ domain: "other.myshopify.com" });

    const hidden = await inboxAction(ctx, post({ intent: "dismiss_setup" }));
    expect(hidden.ok).toBe(true);
    const row = await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } });
    expect(row.setupDismissedAt).toBeInstanceOf(Date);
    expect((await inboxLoader(ctx, new Request("http://app.test/app"))).setup.setupDismissedAt).not.toBeNull();
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: other.shop.id } })).setupDismissedAt).toBeNull();

    await inboxAction(ctx, post({ intent: "show_setup" }));
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } })).setupDismissedAt).toBeNull();
  });
});

describe("review request", () => {
  it("is offered once a dispute is won, and not again right after it was requested", async () => {
    const ctx = await makeStore();
    expect((await inboxLoader(ctx, new Request("http://app.test/app"))).askForReview).toBe(false);
    await syncDisputes(ctx); // fixtures include one won dispute
    expect((await inboxLoader(ctx, new Request("http://app.test/app"))).askForReview).toBe(true);
    expect(await inboxAction(ctx, post({ intent: "review_requested" }))).toMatchObject({ ok: true });
    expect((await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } })).reviewRequestedAt).toBeInstanceOf(Date);
    expect((await inboxLoader(ctx, new Request("http://app.test/app"))).askForReview).toBe(false);
  });
});

describe("lost without a response", () => {
  it("counts lost disputes that never had evidence sent, not ones we fought and lost", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    const fought = await dashboardStats(ctx);
    expect(fought.lost).toBe(1);
    expect(fought.unanswered).toBe(0);

    const lost = await prisma.dispute.findFirstOrThrow({ where: { shopId: ctx.shop.id, status: "LOST" } });
    await prisma.dispute.update({ where: { id: lost.id }, data: { evidenceSentOn: null } });
    const s = await dashboardStats(ctx);
    expect(s.unanswered).toBe(1);
    expect(s.unansweredCents).toBe(lost.amountCents);
  });
});
