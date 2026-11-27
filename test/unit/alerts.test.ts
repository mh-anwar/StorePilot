import { describe, expect, it } from "vitest";
import { digest, dueText, needsAlert, STAGE_NEW, stageFor } from "../../app/lib/alerts/deadlines.server";

describe("alert stages", () => {
  it("maps days left to the 7/3/1 thresholds", () => {
    expect(stageFor(14)).toBe(STAGE_NEW);
    expect(stageFor(8)).toBe(STAGE_NEW);
    expect(stageFor(7)).toBe(7);
    expect(stageFor(4)).toBe(7);
    expect(stageFor(3)).toBe(3);
    expect(stageFor(2)).toBe(3);
    expect(stageFor(1)).toBe(1);
    expect(stageFor(0)).toBe(1);
  });

  it("alerts once per stage, including the first sighting", () => {
    expect(needsAlert(14, null)).toBe(true);
    expect(needsAlert(13, STAGE_NEW)).toBe(false);
    expect(needsAlert(7, STAGE_NEW)).toBe(true);
    expect(needsAlert(5, 7)).toBe(false);
    expect(needsAlert(3, 7)).toBe(true);
    expect(needsAlert(1, 3)).toBe(true);
    expect(needsAlert(0, 1)).toBe(false);
    // A dispute first seen close to its deadline gets one email, not three.
    expect(needsAlert(2, null)).toBe(true);
    expect(stageFor(2)).toBe(3);
  });

  it("words the deadline plainly", () => {
    expect(dueText(0)).toBe("due today");
    expect(dueText(1)).toBe("due tomorrow");
    expect(dueText(5)).toBe("due in 5 days");
  });
});

describe("digest email", () => {
  const item = (over: Partial<Parameters<typeof digest>[2][number]>) => ({
    id: "d1",
    orderName: "#1041",
    reason: "PRODUCT_NOT_RECEIVED",
    amountCents: 31800,
    currencyCode: "USD",
    days: 5,
    stage: 7,
    recommendation: "FIGHT",
    ...over,
  });

  it("names the order, amount and deadline for a single dispute", () => {
    const { subject, text } = digest("Juniper", "juniper.myshopify.com", [item({})]);
    expect(subject).toBe("Chargeback on #1041 due in 5 days ($318.00)");
    expect(text).toContain("Hi Juniper,");
    expect(text).toContain("StorePilot suggests: fight.");
    expect(text).toContain("https://juniper.myshopify.com/admin/apps");
    expect(text).toMatch(/Nothing is sent until you do/);
  });

  it("leads with the most urgent dispute when there are several", () => {
    const { subject, text } = digest("Juniper", "juniper.myshopify.com", [
      item({ id: "a", orderName: "#1", days: 6 }),
      item({ id: "b", orderName: "#2", days: 1, recommendation: null }),
    ]);
    expect(subject).toBe("2 chargebacks need a response, the first due tomorrow");
    expect(text.indexOf("#2")).toBeLessThan(text.indexOf("#1:"));
  });
});
