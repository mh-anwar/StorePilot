import { describe, expect, it } from "vitest";
import { setupGuide, type SetupInput } from "../../app/lib/onboarding";

const fresh: SetupInput = {
  lastSyncedAt: null,
  supportEmail: null,
  refundPolicy: null,
  shippingPolicy: null,
  plan: "free",
  setupDismissedAt: null,
};

describe("setup guide", () => {
  it("starts with nothing done and shows itself", () => {
    const g = setupGuide(fresh, "/app");
    expect(g.visible).toBe(true);
    expect(g.completed).toBe(0);
    expect(g.steps.map((s) => s.id)).toEqual(["sync", "contact", "policies", "plan"]);
    expect(g.steps[0]).toMatchObject({ intent: "sync", href: null });
    expect(g.steps[1].href).toBe("/app/settings");
  });

  it("links steps under the route base so the demo stays in the demo", () => {
    const g = setupGuide(fresh, "/demo");
    expect(g.steps.find((s) => s.id === "plan")?.href).toBe("/demo/billing");
  });

  it("needs both policies, and ignores whitespace-only values", () => {
    const g = setupGuide({ ...fresh, refundPolicy: "30 days", shippingPolicy: "  ", supportEmail: " " }, "/app");
    expect(g.steps.find((s) => s.id === "policies")?.done).toBe(false);
    expect(g.steps.find((s) => s.id === "contact")?.done).toBe(false);
  });

  it("hides once the required steps are done, even on the free plan", () => {
    const g = setupGuide(
      { ...fresh, lastSyncedAt: "2026-11-26T00:00:00Z", supportEmail: "a@b.co", refundPolicy: "r", shippingPolicy: "s" },
      "/app",
    );
    expect(g.completed).toBe(3);
    expect(g.visible).toBe(false);
  });

  it("stays hidden after the merchant dismisses it, and can be brought back while steps remain", () => {
    const g = setupGuide({ ...fresh, setupDismissedAt: "2026-11-26T00:00:00Z" }, "/app");
    expect(g.visible).toBe(false);
    expect(g.restorable).toBe(true);
  });

  it("offers no way back once the required steps are done", () => {
    const done = { ...fresh, lastSyncedAt: "x", supportEmail: "a@b.co", refundPolicy: "r", shippingPolicy: "s" };
    expect(setupGuide(done, "/app").restorable).toBe(false);
    expect(setupGuide({ ...done, setupDismissedAt: "2026-11-26T00:00:00Z" }, "/app").restorable).toBe(false);
  });
});
