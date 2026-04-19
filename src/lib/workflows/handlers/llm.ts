// LLM reasoning step. Produces a structured object conforming to a
// zod schema the step's config declares. Under the hood we use
// generateObject from the AI SDK so the result is typed and validated.
//
// Why this is the real differentiator: a rule in Shopify Flow can't
// evaluate "is this a likely fraud?" or "is this review abusive?" — an
// LLM step can, then downstream steps (a condition, a proposal.gate)
// use its output to decide what to do next.
import { registerStep } from "../registry";
import { generateObject } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { AGENT_MODEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { encryptedSecrets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSecret } from "@/lib/crypto";

async function orgProvider(orgId: string) {
  // Prefer a per-org Anthropic key if the org set one in settings.
  const key = await getSecret(orgId, "anthropic_api_key").catch(() => null);
  return key ? createAnthropic({ apiKey: key }) : anthropic;
}

function schemaFromJson(spec: unknown): z.ZodSchema {
  // Minimal JSON-schema-like object → Zod converter. Intentionally small;
  // we only need what workflow authors declare in step configs.
  if (!spec || typeof spec !== "object") return z.any();
  const s = spec as Record<string, unknown>;
  const type = s.type as string | undefined;
  if (type === "string") return z.string().describe((s.description as string) ?? "");
  if (type === "number") return z.number().describe((s.description as string) ?? "");
  if (type === "integer") return z.number().int().describe((s.description as string) ?? "");
  if (type === "boolean") return z.boolean().describe((s.description as string) ?? "");
  if (type === "enum" && Array.isArray(s.values)) {
    return z.enum(s.values as [string, ...string[]]).describe((s.description as string) ?? "");
  }
  if (type === "array" && s.items) {
    return z.array(schemaFromJson(s.items)).describe((s.description as string) ?? "");
  }
  if (type === "object" && s.properties && typeof s.properties === "object") {
    const shape: Record<string, z.ZodSchema> = {};
    for (const [k, v] of Object.entries(s.properties as Record<string, unknown>)) {
      shape[k] = schemaFromJson(v);
    }
    return z.object(shape);
  }
  return z.any();
}

registerStep("llm.reason", {
  category: "LLM",
  description:
    "Call an LLM with a prompt and a structured output schema. Downstream steps reference its fields via {{steps.<id>.output.<field>}}.",
  handler: async (_step, cfg, ctx) => {
    const prompt = String(cfg.prompt ?? "");
    if (!prompt) return { status: "error", error: "llm.reason requires 'prompt'" };
    const schema = schemaFromJson(cfg.output ?? { type: "object", properties: {} });
    const provider = await orgProvider(ctx.orgId);
    const model = (cfg.model as string) || AGENT_MODEL;
    try {
      const { object } = await generateObject({
        model: provider(model),
        schema,
        prompt,
        // Include a digest of trigger data + named step outputs so the
        // prompt can freely reference "the order" or "the stock report"
        // without the author having to template everything in.
        system:
          `You are a step in a StorePilot workflow. Be precise and decisive. ` +
          `Return the requested structured output. Available context:\n` +
          `trigger = ${JSON.stringify(ctx.trigger).slice(0, 4000)}\n` +
          `steps = ${JSON.stringify(ctx.steps).slice(0, 4000)}`,
      });
      return { status: "ok", output: object };
    } catch (e) {
      return { status: "error", error: (e as Error).message };
    }
  },
});

registerStep("llm.classify", {
  category: "LLM",
  description:
    "Classify some input into one of a fixed set of labels. Shorthand for llm.reason with an enum schema.",
  handler: async (_step, cfg, ctx) => {
    const input = String(cfg.input ?? "");
    const labels = (cfg.labels as string[]) ?? [];
    if (!input || labels.length < 2) {
      return { status: "error", error: "llm.classify requires 'input' and at least 2 labels" };
    }
    const provider = await orgProvider(ctx.orgId);
    const { object } = await generateObject({
      model: provider(AGENT_MODEL),
      schema: z.object({
        label: z.enum(labels as [string, ...string[]]),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
      prompt: `Classify this into one of: ${labels.join(", ")}.\n\nInput:\n${input}`,
    });
    return { status: "ok", output: object };
  },
});
