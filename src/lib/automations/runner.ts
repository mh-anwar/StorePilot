import { db } from "@/lib/db";
import { automations, automationRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText, stepCountIs } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { agents } from "@/lib/agents/registry";
import { AGENT_MODEL, MAX_AGENT_STEPS } from "@/lib/constants";
import type { ToolSet } from "ai";

// Executes an automation as a non-streaming agent run. Persists the result
// (including tool calls) to automation_runs so it shows up in the dashboard.
export async function runAutomation(
  automationId: number,
  opts?: { apiKey?: string }
) {
  const [a] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId));
  if (!a) throw new Error("automation not found");

  const [run] = await db
    .insert(automationRuns)
    .values({ automationId, status: "running" })
    .returning({ id: automationRuns.id });

  try {
    const toolMap: ToolSet = {};
    for (const agent of Object.values(agents)) {
      for (const [k, v] of Object.entries(agent.tools)) toolMap[k] = v;
    }
    const provider = opts?.apiKey
      ? createAnthropic({ apiKey: opts.apiKey })
      : anthropic;

    const result = await generateText({
      model: provider(AGENT_MODEL),
      system:
        "You are a StorePilot automation. Execute the user's instruction using the available tools. Summarize clearly and concisely for a merchant reading an automation log.",
      prompt: a.prompt,
      tools: toolMap,
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
    });

    const toolCalls = result.steps
      .flatMap((s) => s.toolCalls || [])
      .map((c) => ({ name: c.toolName, args: c.input }));

    await db
      .update(automationRuns)
      .set({
        status: "succeeded",
        output: result.text,
        toolCalls,
        finishedAt: new Date(),
      })
      .where(eq(automationRuns.id, run.id));
    await db
      .update(automations)
      .set({ lastRunAt: new Date() })
      .where(eq(automations.id, automationId));

    return { ok: true, runId: run.id, output: result.text };
  } catch (e) {
    await db
      .update(automationRuns)
      .set({
        status: "failed",
        error: (e as Error).message,
        finishedAt: new Date(),
      })
      .where(eq(automationRuns.id, run.id));
    throw e;
  }
}
