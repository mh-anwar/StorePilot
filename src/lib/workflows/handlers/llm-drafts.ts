// LLM helpers that produce ready-to-use drafts the merchant can pipe
// into notify.email or a proposal.gate. These stick to small, repeatable
// shapes so workflows stay easy to wire.
import { registerStep } from "../registry";
import { generateObject } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { AGENT_MODEL } from "@/lib/constants";
import { getSecret } from "@/lib/crypto";

async function provider(orgId: string) {
  const key = await getSecret(orgId, "anthropic_api_key").catch(() => null);
  return key ? createAnthropic({ apiKey: key }) : anthropic;
}

registerStep("llm.draft_email_reply", {
  category: "LLM",
  description:
    "Draft a tone-matched reply to a customer message. Output: { subject, body }.",
  handler: async (_step, cfg, ctx) => {
    const context = String(cfg.context ?? "");
    const tone = String(cfg.tone ?? "friendly, professional, concise");
    const signer = String(cfg.signer ?? "The team");
    if (!context) return { status: "error", error: "context required" };
    const p = await provider(ctx.orgId);
    const { object } = await generateObject({
      model: p(AGENT_MODEL),
      schema: z.object({
        subject: z.string(),
        body: z.string(),
      }),
      prompt: `You are writing a customer-facing email on behalf of a store.
Tone: ${tone}
Signer: ${signer}
Context:
${context}

Write a subject line and the full body. Do not invent facts; if details are missing, acknowledge it generally.`,
    });
    return { status: "ok", output: object };
  },
});

registerStep("llm.summarize_run", {
  category: "LLM",
  description:
    "One-paragraph summary of what the workflow has done so far. Useful before a proposal.gate so approvers have context.",
  handler: async (_step, _cfg, ctx) => {
    const p = await provider(ctx.orgId);
    const { object } = await generateObject({
      model: p(AGENT_MODEL),
      schema: z.object({ summary: z.string() }),
      prompt: `Summarize this workflow run so far in one short paragraph. Include the trigger data and the key outputs of each step.

Trigger: ${JSON.stringify(ctx.trigger).slice(0, 3000)}
Steps: ${JSON.stringify(ctx.steps).slice(0, 4000)}`,
    });
    return { status: "ok", output: object };
  },
});

registerStep("llm.extract", {
  category: "LLM",
  description:
    "Extract structured fields from unstructured text (customer message, review, product description). Output shape is declared in config.output.",
  handler: async (_step, cfg, ctx) => {
    const input = String(cfg.input ?? "");
    const output = cfg.output as Record<string, unknown> | undefined;
    if (!input || !output) {
      return { status: "error", error: "input + output (schema) required" };
    }
    // Reuse the same mini JSON-schema → Zod converter by delegating to
    // the llm.reason step with a prompt that says "extract from this".
    const { object } = await generateObject({
      model: (await provider(ctx.orgId))(AGENT_MODEL),
      schema: extractSchema(output),
      prompt: `Extract the requested fields from the following text. If a field isn't stated, leave it null.

Text:
${input}`,
    });
    return { status: "ok", output: object };
  },
});

function extractSchema(spec: Record<string, unknown>): z.ZodSchema {
  const props = (spec.properties as Record<string, { type: string; description?: string }>) ?? {};
  const shape: Record<string, z.ZodSchema> = {};
  for (const [k, v] of Object.entries(props)) {
    const base =
      v.type === "number"
        ? z.number().nullable()
        : v.type === "boolean"
          ? z.boolean().nullable()
          : z.string().nullable();
    shape[k] = v.description ? base.describe(v.description) : base;
  }
  return z.object(shape);
}
