// First-run: the setup guide's inputs, hiding/restoring it, and the
// "lost without a response" number on the home page.
import { beforeEach, describe, expect, it } from "vitest";
import { detailAction, detailLoader, inboxAction, inboxLoader } from "../../app/lib/handlers.server";
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

describe("out of packs", () => {
  it("flags the dispute page and returns a plan_limit code the UI can offer an upgrade for", async () => {
    const ctx = await makeStore({ plan: "free" });
    await syncDisputes(ctx);
    const open = await prisma.dispute.findMany({ where: { shopId: ctx.shop.id, status: "NEEDS_RESPONSE" } });
    const build = (id: string) => detailAction(ctx, id, new Request("http://app.test/x", { method: "POST", body: new URLSearchParams({ intent: "build" }) }));

    expect((await detailLoader(ctx, open[3].id)).outOfPacks).toBe(false);
    for (const d of open.slice(0, 3)) expect(await build(d.id)).toMatchObject({ ok: true });

    const blocked = await detailLoader(ctx, open[3].id);
    expect(blocked).toMatchObject({ outOfPacks: true, packsLimit: 3 });
    expect(await build(open[3].id)).toMatchObject({ ok: false, code: "plan_limit" });
    // A dispute that already has a pack isn't blocked: rebuilding is free.
    expect((await detailLoader(ctx, open[0].id)).outOfPacks).toBe(false);

    const pro = await makeStore({ plan: "pro", domain: "pro.myshopify.com" });
    await syncDisputes(pro);
    const proOpen = await prisma.dispute.findFirstOrThrow({ where: { shopId: pro.shop.id, status: "NEEDS_RESPONSE" } });
    expect(await detailLoader(pro, proOpen.id)).toMatchObject({ outOfPacks: false, packsLimit: null });
  });
});

describe("lost without a response", () => {
  it("counts lost disputes that never had evidence sent, not ones we fought and lost", async () => {
    const ctx = await makeStore();
    await syncDisputes(ctx);
    // The fixture's lost dispute expired before anyone answered it.
    const lost = await prisma.dispute.findFirstOrThrow({ where: { shopId: ctx.shop.id, status: "LOST" } });
    const s = await dashboardStats(ctx);
    expect(s.lost).toBe(1);
    expect(s.unanswered).toBe(1);
    expect(s.unansweredCents).toBe(lost.amountCents);

    // Had evidence gone out, it's an ordinary loss, not an unanswered one.
    await prisma.dispute.update({ where: { id: lost.id }, data: { evidenceSentOn: new Date() } });
    const fought = await dashboardStats(ctx);
    expect(fought.lost).toBe(1);
    expect(fought.unanswered).toBe(0);
  });
});
