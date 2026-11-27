// Deadline alert emails end to end: who gets them, when, and that a rerun
// never sends the same stage twice.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDeadlineAlerts } from "../../app/lib/alerts/deadlines.server";
import { setEmailTransport, type EmailMessage } from "../../app/lib/alerts/email.server";
import { decide } from "../../app/lib/disputes/pack.server";
import { syncDisputes } from "../../app/lib/disputes/sync.server";
import { settingsAction } from "../../app/lib/handlers.server";
import { loader as cronLoader } from "../../app/routes/cron.deadlines";
import { prisma, resetDb } from "../helpers/db";
import { makeStore, NOW } from "../helpers/store";

let outbox: EmailMessage[] = [];
beforeEach(async () => {
  await resetDb();
  outbox = [];
  setEmailTransport(async (m) => {
    outbox.push(m);
    return { sent: true, id: `msg-${outbox.length}` };
  });
});
afterEach(() => {
  setEmailTransport(null);
  delete process.env.CRON_SECRET;
});

async function growthStore(opts: { plan?: string } = {}) {
  const ctx = await makeStore({ plan: opts.plan ?? "growth" });
  ctx.shop = await prisma.shop.update({ where: { id: ctx.shop.id }, data: { email: "owner@junipertrail.example.com" } });
  await syncDisputes(ctx);
  return ctx;
}

const openAlertable = (shopId: string) =>
  prisma.dispute.count({ where: { shopId, status: "NEEDS_RESPONSE", evidenceDueBy: { gt: NOW } } });

describe("deadline alerts", () => {
  it("sends one digest for every open dispute, then nothing until a deadline crosses a threshold", async () => {
    const ctx = await growthStore();
    const expected = await openAlertable(ctx.shop.id);
    expect(expected).toBeGreaterThan(0);

    const first = await runDeadlineAlerts(NOW);
    expect(first).toMatchObject({ emails: 1, disputes: expected, failures: 0 });
    expect(outbox[0].to).toBe("owner@junipertrail.example.com");
    expect(outbox[0].subject).toMatch(/chargeback/i);

    expect(await runDeadlineAlerts(NOW)).toMatchObject({ emails: 0, disputes: 0 });

    // Push one dispute's deadline into the 1-day window: only it gets emailed.
    const d = await prisma.dispute.findFirstOrThrow({
      where: { shopId: ctx.shop.id, status: "NEEDS_RESPONSE", alertStage: { gt: 1 } },
    });
    await prisma.dispute.update({ where: { id: d.id }, data: { evidenceDueBy: new Date(NOW.getTime() + 20 * 3600_000) } });
    const again = await runDeadlineAlerts(NOW);
    expect(again).toMatchObject({ emails: 1, disputes: 1 });
    expect(outbox[1].subject).toContain("due tomorrow");
    expect((await prisma.activity.count({ where: { shopId: ctx.shop.id, kind: "alerted" } }))).toBe(2);
  });

  it("leaves out accepted disputes and uses the alert address when set", async () => {
    const ctx = await growthStore();
    const open = await prisma.dispute.findMany({
      where: { shopId: ctx.shop.id, status: "NEEDS_RESPONSE", evidenceDueBy: { gt: NOW } },
    });
    await decide(ctx, open[0].id, "ACCEPT");
    await prisma.shop.update({ where: { id: ctx.shop.id }, data: { alertEmail: "disputes@junipertrail.example.com" } });
    const r = await runDeadlineAlerts(NOW);
    expect(r.disputes).toBe(open.length - 1);
    expect(outbox[0].to).toBe("disputes@junipertrail.example.com");
  });

  it("skips free shops, shops that turned alerts off, uninstalled shops and unconfigured servers", async () => {
    await growthStore({ plan: "free" });
    expect(await runDeadlineAlerts(NOW)).toMatchObject({ shops: 0, emails: 0 });

    await resetDb();
    const off = await growthStore();
    await prisma.shop.update({ where: { id: off.shop.id }, data: { deadlineAlerts: false } });
    expect((await runDeadlineAlerts(NOW)).emails).toBe(0);
    await prisma.shop.update({ where: { id: off.shop.id }, data: { deadlineAlerts: true, uninstalledAt: NOW } });
    expect((await runDeadlineAlerts(NOW)).emails).toBe(0);

    setEmailTransport(null);
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    expect(await runDeadlineAlerts(NOW)).toMatchObject({ skipped: "email not configured" });
    if (saved) process.env.RESEND_API_KEY = saved;
  });

  it("does not mark disputes as alerted when the email fails, so the next run retries", async () => {
    const ctx = await growthStore();
    setEmailTransport(async () => ({ sent: false, reason: "provider down" }));
    expect(await runDeadlineAlerts(NOW)).toMatchObject({ emails: 0, failures: 1 });
    expect(await prisma.dispute.count({ where: { shopId: ctx.shop.id, alertStage: { not: null } } })).toBe(0);
  });

  it("settings turn alerts off and validate the address", async () => {
    const ctx = await growthStore();
    const form = (f: Record<string, string>) =>
      new Request("http://app.test/app/settings", { method: "POST", body: new URLSearchParams({ intent: "save", ...f }) });
    expect(await settingsAction(ctx, form({ alertEmail: "nope", deadlineAlerts: "true" }))).toMatchObject({ ok: false });
    expect(await settingsAction(ctx, form({ alertEmail: "a@b.co", deadlineAlerts: "false" }))).toMatchObject({ ok: true });
    const row = await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } });
    expect(row).toMatchObject({ alertEmail: "a@b.co", deadlineAlerts: false });
    // A save without the alert fields (older client) leaves them alone.
    await settingsAction(ctx, form({}));
    expect(await prisma.shop.findUniqueOrThrow({ where: { id: ctx.shop.id } })).toMatchObject({ alertEmail: "a@b.co", deadlineAlerts: false });
  });
});

describe("test email from settings", () => {
  const testEmail = () => new Request("http://app.test/app/settings", { method: "POST", body: new URLSearchParams({ intent: "test_email" }) });

  it("goes to the alert address, or the store email when none is set", async () => {
    const ctx = await growthStore();
    expect(await settingsAction(ctx, testEmail())).toMatchObject({ ok: true });
    expect(outbox[0]).toMatchObject({ to: "owner@junipertrail.example.com", subject: "StorePilot test email" });
    ctx.shop = await prisma.shop.update({ where: { id: ctx.shop.id }, data: { alertEmail: "disputes@example.com" } });
    await settingsAction(ctx, testEmail());
    expect(outbox[1].to).toBe("disputes@example.com");
  });

  it("explains why when it can't send", async () => {
    const ctx = await growthStore();
    setEmailTransport(async () => ({ sent: false, reason: "resend 403" }));
    expect(await settingsAction(ctx, testEmail())).toMatchObject({ ok: false, error: expect.stringContaining("resend 403") });
    setEmailTransport(null);
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    expect(await settingsAction(ctx, testEmail())).toMatchObject({ ok: false, error: expect.stringContaining("switched on") });
    if (saved) process.env.RESEND_API_KEY = saved;
  });
});

describe("/cron/deadlines", () => {
  const call = (auth?: string) =>
    cronLoader({
      request: new Request("http://app.test/cron/deadlines", auth ? { headers: { authorization: auth } } : {}),
    } as never) as Promise<Response>;

  it("is hidden without CRON_SECRET and needs the bearer token with it", async () => {
    expect((await call("Bearer x")).status).toBe(404);
    process.env.CRON_SECRET = "s3cret-value";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-value")).status).toBe(401);
    const ok = await call("Bearer s3cret-value");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ emails: 0 });
  });
});
