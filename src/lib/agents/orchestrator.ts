import { streamText, tool, stepCountIs, type ToolSet } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getAllAgentDescriptions, agents } from "./registry";
import { AGENT_MODEL, MAX_AGENT_STEPS } from "../constants";
import type { ModelMessage } from "ai";

function buildToolMap(): ToolSet {
  const toolMap: ToolSet = {};

  for (const [, agentDef] of Object.entries(agents)) {
    for (const [toolName, toolDef] of Object.entries(agentDef.tools)) {
      toolMap[toolName] = toolDef;
    }
  }

  toolMap["plan_workflow"] = tool({
    description:
      "Break a complex merchant request into an ordered list of steps, each assigned to a sub-agent. Use this for requests that require coordination across multiple agents (e.g., 'prepare my store for a summer sale', 'full store audit').",
    inputSchema: z.object({
      goal: z.string().describe("The overall goal of the workflow"),
      steps: z.array(
        z.object({
          stepNumber: z.number(),
          agent: z.enum(["analytics", "content", "inventory", "marketing"]),
          action: z.string().describe("What this step should accomplish"),
          tool: z.string().describe("Which tool to call for this step"),
          dependsOn: z
            .array(z.number())
            .optional()
            .describe("Step numbers this depends on"),
        })
      ),
    }),
    execute: async ({ goal, steps }) => {
      return {
        workflow: goal,
        steps,
        status: "planned",
        instruction:
          "Now execute each step in order using the specified tools. Report results after each step.",
      };
    },
  });

  return toolMap;
}

const SUPERVISOR_SYSTEM = `You are StorePilot, an AI commerce copilot that helps Shopify-style merchants manage their online store through natural language.

You orchestrate a team of specialized agents, each with their own tools:

${getAllAgentDescriptions()}

## How To Work

Tools are available directly — call them by their full name (e.g., \`analytics__query_revenue\`, \`content__generate_description\`).

**For simple requests**: Use the appropriate tool(s) directly.
**For complex, multi-step requests**: First call \`plan_workflow\` to create a step-by-step plan, then execute each step.

## Response Guidelines

- Always explain what you're about to do before calling tools
- After getting results, present them with business context and actionable insights
- Use formatted tables for ranked/comparative data
- Bold key numbers and metrics
- When data suggests action items, recommend specific next steps
- If you're uncertain about a date range, default to last 30 days and state this assumption
- Be conversational but professional — you're a knowledgeable commerce advisor

## Important

- Never fabricate data — always use tools to query real store data
- Show your reasoning when making recommendations
- If a request is ambiguous, ask for clarification rather than guessing
- When multiple agents' tools are relevant, coordinate them for a comprehensive answer`;

export function createOrchestratorStream(
  messages: ModelMessage[],
  options?: { apiKey?: string; model?: string }
) {
  const tools = buildToolMap();
  const provider = options?.apiKey
    ? createAnthropic({ apiKey: options.apiKey })
    : anthropic;

  return streamText({
    model: provider(options?.model || AGENT_MODEL),
    system: SUPERVISOR_SYSTEM,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });
}
