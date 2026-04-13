"use client";

import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { AgentStep } from "./agent-step";
import { ToolResultCard } from "./tool-result-card";
import { Markdown } from "@/components/shared/markdown";
import { User, Bot } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolInfo(part: any) {
  const toolName = (part.toolName as string) || String(part.type).replace("tool-", "");
  const split = toolName.split("__");
  return {
    agentName: split.length > 1 ? split[0] : "plan",
    toolName: split.length > 1 ? split.slice(1).join("__") : toolName,
    toolCallId: part.toolCallId as string,
    state: part.state as string,
    input: (part.input ?? {}) as Record<string, unknown>,
    output: part.output as unknown,
  };
}

export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts?.filter(p => p.type === "text").map(p => (p as { type: "text"; text: string }).text).join("") || "";
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[75%]">
          <p className="text-sm">{text}</p>
        </div>
        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3.5 w-3.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center mt-0.5">
        <Bot className="h-3.5 w-3.5 text-violet-400" />
      </div>
      <div className="flex flex-col gap-2 min-w-0 max-w-[85%]">
        {message.parts?.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div key={`t-${i}`} className="prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-none">
                <Markdown content={part.text} />
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const t = getToolInfo(part as unknown);
            return (
              <div key={`tool-${t.toolCallId}`} className="space-y-1">
                <AgentStep agentName={t.agentName} toolName={t.toolName} state={t.state} args={t.input} />
                {(t.state === "result" || t.state === "output") && (
                  <ToolResultCard toolName={t.toolName} result={t.output} />
                )}
              </div>
            );
          }

          if (part.type === "step-start") {
            return <div key={`s-${i}`} className="text-[11px] text-muted-foreground/40 border-l-2 border-border pl-2" />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
