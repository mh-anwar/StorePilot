import { expect, it } from "vitest";
import { assess } from "../../app/lib/disputes/evidence";
import { clip, draftFromTemplate, FIELD_LIMIT, LETTER_LIMIT, type DraftContext } from "../../app/lib/disputes/draft/template";
import { makeDispute, makeSnapshot } from "../fixtures/disputes";
import type { DisputeReason } from "../../app/lib/disputes/types";
function context(reason: DisputeReason): DraftContext {
  const dispute = makeDispute({ reason }); const snapshot = makeSnapshot();
  return { dispute, snapshot, assessment: assess(dispute, snapshot), shopName: "Canvas Store" };
}
it("trims and clips at field and custom limits", () => {
  expect(clip(" hello ")).toBe("hello");
  expect(clip("12345", 5)).toBe("12345");
  expect(clip("123456", 5)).toBe("1234…");
  expect(clip("word ".repeat(1000)).length).toBeLessThanOrEqual(FIELD_LIMIT);
});
it.each<[DisputeReason, string[]]>([
  ["FRAUDULENT", ["accessActivityLog"]],
  ["PRODUCT_UNACCEPTABLE", ["refundPolicyDisclosure", "refundRefusalExplanation"]],
  ["SUBSCRIPTION_CANCELLED", ["cancellationPolicyDisclosure", "cancellationRebuttal"]],
])("includes relevant fields for %s", (reason, keys) => {
  const fields = draftFromTemplate(context(reason));
  for (const key of keys) expect(fields).toHaveProperty(key, expect.any(String));
});
it("omits shippingAddress for digital orders", () => {
  const ctx = context("FRAUDULENT"); ctx.snapshot.lineItems.forEach(li => li.requiresShipping = false);
  expect(draftFromTemplate(ctx)).not.toHaveProperty("shippingAddress");
});
it("names the order and disputed amount in its letter", () => {
  const fields = draftFromTemplate(context("PRODUCT_NOT_RECEIVED"));
  expect(fields.uncategorizedText).toContain("#1001"); expect(fields.uncategorizedText).toContain("$125.00");
});
it("caps even an oversized letter at LETTER_LIMIT", () => {
  const ctx = context("PRODUCT_NOT_RECEIVED"); ctx.snapshot.lineItems[0].title = "Large product description ".repeat(1000);
  expect(draftFromTemplate(ctx).uncategorizedText!.length).toBeLessThanOrEqual(LETTER_LIMIT);
});
