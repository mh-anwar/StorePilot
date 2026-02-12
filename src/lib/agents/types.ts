import type { ToolSet } from "ai";

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolSet;
}
