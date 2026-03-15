"use client";

import type { UIMessage, UIMessagePart } from "ai";
import { isToolUIPart } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { AgentStep } from "./agent-step";
import { ToolResultCard } from "./tool-result-card";
import { Markdown } from "@/components/shared/markdown";
import { User, Bot } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolInfo(part: any) {
  // Dynamic tools have type 'dynamic-tool' and toolName on the part
  // Static tools have type 'tool-{name}'
  const p = part as Record<string, unknown>;
  const toolName = (p.toolName as string) || String(p.type).replace("tool-", "");
  const splitParts = toolName.split("__");
  const agentName = splitParts.length > 1 ? splitParts[0] : "plan";
  const shortName = splitParts.length > 1 ? splitParts.slice(1).join("__") : toolName;
  return {
    agentName,
    toolName: shortName,
    toolCallId: p.toolCallId as string,
    state: p.state as string,
    input: (p.input ?? {}) as Record<string, unknown>,
    output: p.output as unknown,
  };
}

export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3 justify-end"
      >
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
          <p className="text-sm">
            {message.parts
              ?.filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("") || ""}
          </p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
        <Bot className="h-4 w-4 text-violet-400" />
      </div>
      <div className="flex flex-col gap-2 max-w-[85%] min-w-0">
        <AnimatePresence mode="popLayout">
          {message.parts?.map((part, i) => {
            if (part.type === "text" && part.text.trim()) {
              return (
                <motion.div
                  key={`text-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-none"
                >
                  <Markdown content={part.text} />
                </motion.div>
              );
            }

            if (isToolUIPart(part)) {
              const tool = getToolInfo(part as unknown);
              return (
                <motion.div
                  key={`tool-${tool.toolCallId}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="space-y-1"
                >
                  <AgentStep
                    agentName={tool.agentName}
                    toolName={tool.toolName}
                    state={tool.state}
                    args={tool.input}
                  />
                  {(tool.state === "result" || tool.state === "output") && (
                    <ToolResultCard
                      toolName={tool.toolName}
                      result={tool.output}
                    />
                  )}
                </motion.div>
              );
            }

            if (part.type === "step-start") {
              return (
                <motion.div
                  key={`step-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  className="text-xs text-muted-foreground border-l-2 border-muted pl-2 my-1"
                >
                  Thinking...
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
