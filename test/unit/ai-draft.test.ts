import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { draftWithClaude, modelForPlan, MODEL_GROWTH, MODEL_PRO, setAnthropicClient, type MessagesClient, type ModelDraft } from "../../app/lib/disputes/draft/ai.server";
import { assess } from "../../app/lib/disputes/evidence";
import { FIELD_LIMIT, LETTER_LIMIT } from "../../app/lib/disputes/draft/template";
import { makeDispute, makeSnapshot } from "../fixtures/disputes";

const dispute = makeDispute({ reason: "FRAUDULENT" });
const snapshot = makeSnapshot();
const ctx = { dispute, snapshot, assessment: assess(dispute, snapshot), shopName: "Canvas Store" };
function parsed(overrides: Partial<ModelDraft> = {}): ModelDraft {
  return { rebuttalLetter: "Please reverse this chargeback.", accessActivityLog: null, refundPolicyDisclosure: null, refundRefusalExplanation: null, cancellationPolicyDisclosure: null, cancellationRebuttal: null, shippingAddress: null, merchantNotes: ["Attach tracking."], ...overrides };
}
function fake(response: object) {
  const parse = vi.fn().mockResolvedValue(response);
  setAnthropicClient({ beta: { messages: { parse } } } as unknown as MessagesClient);
  return parse;
}
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("STOREPILOT_MODEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { setAnthropicClient(null); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("merges parsed output with snapshot identity, drops nulls and clips text", async () => {
  fake({ stop_reason: "end_turn", model: "resolved-model", parsed_output: { ...parsed({ rebuttalLetter: "Letter ".repeat(1000), accessActivityLog: "Activity ".repeat(1000), merchantNotes: ["1", "2", "3", "4", "5"], shippingAddress: { address1: "Invented", address2: null, city: null, province: null, zip: null, country: null } }), customerFirstName: "Invented", customerLastName: "Person", customerEmailAddress: "fake@example.com" } });
  const result = await draftWithClaude(ctx, MODEL_PRO);
  expect(result).not.toBeNull();
  expect(result!.fields).toMatchObject({ customerFirstName: "Ada", customerLastName: "Lovelace", customerEmailAddress: "ada@example.com", shippingAddress: snapshot.shippingAddress });
  expect(result!.fields).not.toHaveProperty("refundPolicyDisclosure");
  expect(result!.fields).not.toHaveProperty("cancellationRebuttal");
  expect(result!.fields.uncategorizedText!.length).toBeLessThanOrEqual(LETTER_LIMIT);
  expect(result!.fields.uncategorizedText).toMatch(/…$/);
  expect(result!.fields.accessActivityLog!.length).toBeLessThanOrEqual(FIELD_LIMIT);
  expect(result!.fields.accessActivityLog).toMatch(/…$/);
  expect(result!.model).toBe("resolved-model"); expect(result!.merchantNotes).toEqual(["1", "2", "3", "4"]);
});
it.each(["refusal", "max_tokens"])("returns null on %s even with parsed output", async stop_reason => {
  fake({ stop_reason, parsed_output: parsed() });
  expect(await draftWithClaude(ctx, MODEL_PRO)).toBeNull();
});
it("returns null on a thrown error", async () => {
  const parse = fake({}); parse.mockRejectedValue(new Error("offline"));
  expect(await draftWithClaude(ctx, MODEL_PRO)).toBeNull();
});
it("returns null without a client or API key", async () => {
  setAnthropicClient(null);
  expect(await draftWithClaude(ctx, MODEL_PRO)).toBeNull();
});
it("returns null when no parsed output is returned", async () => {
  fake({ stop_reason: "end_turn", parsed_output: null });
  expect(await draftWithClaude(ctx, MODEL_PRO)).toBeNull();
});
it.each([MODEL_PRO, MODEL_GROWTH])("sets model-specific fallback options for %s", async model => {
  const parse = fake({ stop_reason: "end_turn", parsed_output: parsed() });
  expect(await draftWithClaude(ctx, model)).not.toBeNull();
  const request = parse.mock.calls[0][0];
  expect(request.model).toBe(model);
  if (model === MODEL_PRO) {
    expect(request.betas).toEqual(["server-side-fallback-2026-07-01"]); expect(request.fallbacks).toBe("default");
  } else {
    expect(request).not.toHaveProperty("betas"); expect(request).not.toHaveProperty("fallbacks");
  }
});
it("selects plan models and respects the environment override", () => {
  expect(modelForPlan("free")).toBeNull(); expect(modelForPlan("unknown")).toBeNull();
  expect(modelForPlan("pro")).toBe(MODEL_PRO); expect(modelForPlan("growth")).toBe(MODEL_GROWTH);
  vi.stubEnv("STOREPILOT_MODEL", "custom-model");
  for (const plan of ["free", "growth", "pro"]) expect(modelForPlan(plan)).toBe("custom-model");
});
