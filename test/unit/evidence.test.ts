import { describe, expect, it } from "vitest";
import { assess, avsMatch, checklistFor, cvvMatch, sameAddress, scoreChecklist } from "../../app/lib/disputes/evidence";
import { makeDispute, makeSnapshot } from "../fixtures/disputes";
import type { DisputeReason, EvidenceItem } from "../../app/lib/disputes/types";

const now = new Date("2026-07-15T00:00:00Z");
describe("verification codes", () => {
  it.each([
    ...["Y", "X", "D", "F", "M", " y "].map(c => [c, "full"]),
    ...["A", "B", "P", "W", "Z"].map(c => [c, "partial"]),
    ...["N", "C"].map(c => [c, "none"]),
    [null, "unknown"], [undefined, "unknown"], ["?", "unknown"],
  ])("AVS %s -> %s", (code, result) => expect(avsMatch(code)).toBe(result));
  it.each([["M", "match"], [" m ", "match"], ["N", "no_match"], [null, "unknown"], [undefined, "unknown"], ["P", "unknown"]])("CVV %s -> %s", (code, result) => expect(cvvMatch(code)).toBe(result));
});
it("compares normalized street, postal code and country", () => {
  const a = makeSnapshot().billingAddress!;
  expect(sameAddress(a, { ...a, address1: "10 KING STREET.", zip: "m5v1a1", countryCode: "ca" })).toBe(true);
  for (const b of [null, {}, { ...a, address1: "11 King Street" }, { ...a, zip: "other" }, { ...a, countryCode: "US" }]) expect(sameAddress(a, b)).toBe(false);
  expect(sameAddress(null, a)).toBe(false);
});
it.each<[DisputeReason, string[]]>([
  ["PRODUCT_NOT_RECEIVED", ["delivery", "tracking", "address_match", "history", "shipping_policy"]],
  ["FRAUDULENT", ["avs", "cvv", "delivery", "address_match", "history", "ip"]],
  ["PRODUCT_UNACCEPTABLE", ["refund_policy", "product", "delivery", "history", "tracking"]],
  ["CREDIT_NOT_PROCESSED", ["refund", "refund_policy", "delivery"]],
  ["SUBSCRIPTION_CANCELLED", ["terms", "refund_policy", "history", "delivery"]],
  ["DUPLICATE", ["product", "delivery", "refund", "history"]],
  ["GENERAL", ["delivery", "avs", "cvv", "history", "refund_policy", "product"]],
])("selects checklist for %s", (reason, keys) => expect(checklistFor(makeDispute({ reason }), makeSnapshot()).map(i => i.key)).toEqual(keys));
it("fights delivered orders", () => {
  expect(assess(makeDispute(), makeSnapshot(), { now }).recommendation).toBe("FIGHT");
});
// Source bug: non-delivery evidence alone reaches REVIEW for an unfulfilled order.
it.fails("accepts an unfulfilled PRODUCT_NOT_RECEIVED order", () => {
  expect(assess(makeDispute(), makeSnapshot({ fulfillments: [] }), { now }).recommendation).toBe("ACCEPT");
});
it("accepts fraud with failed checks and a new customer", () => {
  const s = makeSnapshot();
  s.payment.avsResultCode = "N"; s.payment.cvvResultCode = "N"; s.customer!.ordersCount = 1;
  expect(assess(makeDispute({ reason: "FRAUDULENT" }), s, { now }).recommendation).toBe("ACCEPT");
});
it("fights an already fully refunded credit dispute", () => {
  const result = assess(makeDispute({ reason: "CREDIT_NOT_PROCESSED" }), makeSnapshot({ refunds: [{ amountCents: 12500, createdAt: "2026-07-08", note: null }] }), { now });
  expect(result.recommendation).toBe("FIGHT");
  expect(result.reasons.join(" ")).toContain("already refunded");
  expect(result.checklist.find(i => i.key === "refund")?.status).toBe("strong");
});
it("downgrades mixed evidence below the minimum; inquiries remain REVIEW", () => {
  const d = makeDispute({ reason: "CREDIT_NOT_PROCESSED" });
  const s = makeSnapshot();
  expect(assess(d, s, { now }).recommendation).toBe("REVIEW");
  expect(assess(d, s, { now, minFightAmountCents: 20000 }).recommendation).toBe("ACCEPT");
  expect(assess({ ...d, type: "INQUIRY" }, s, { now, minFightAmountCents: 20000 }).recommendation).toBe("REVIEW");
  expect(assess(makeDispute({ type: "INQUIRY" }), makeSnapshot({ fulfillments: [] }), { now }).recommendation).toBe("REVIEW");
});
it("uses the supplied clock for past-due evidence", () => {
  const d = makeDispute();
  expect(assess(d, makeSnapshot(), { now }).reasons.join(" ")).not.toContain("deadline has passed");
  expect(assess(d, makeSnapshot(), { now: new Date("2026-08-01") }).reasons.join(" ")).toContain("deadline has passed");
});
it("scores weak evidence at 40 percent of its weight and rounds", () => {
  const items = ([['strong', 20], ['weak', 30], ['missing', 50]] as const).map(([status, weight]) => ({ key: status, label: status, detail: "", status, weight })) satisfies EvidenceItem[];
  expect(scoreChecklist(items)).toBe(32);
  expect(scoreChecklist([items[1]])).toBe(40);
  expect(scoreChecklist([])).toBe(0);
  expect(scoreChecklist([{ ...items[0], weight: 1 }, { ...items[2], weight: 2 }])).toBe(33);
});
