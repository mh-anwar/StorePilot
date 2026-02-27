import type { AgentDefinition } from "./types";
import { analyticsAgent } from "./analytics/agent";
import { contentAgent } from "./content/agent";
import { inventoryAgent } from "./inventory/agent";
import { marketingAgent } from "./marketing/agent";

export const agents: Record<string, AgentDefinition> = {
  analytics: analyticsAgent,
  content: contentAgent,
  inventory: inventoryAgent,
  marketing: marketingAgent,
};

export function getAgent(name: string): AgentDefinition {
  const agent = agents[name];
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  return agent;
}

export function getAllAgentDescriptions(): string {
  return Object.values(agents)
    .map((a) => `- **${a.name}**: ${a.description}`)
    .join("\n");
}
