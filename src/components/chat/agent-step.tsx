"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  Package,
  Megaphone,
  Loader2,
  CheckCircle2,
  Bot,
  Workflow,
} from "lucide-react";

const AGENT_CONFIG: Record<
  string,
  { icon: typeof Bot; color: string; bg: string; label: string }
> = {
  analytics: {
    icon: BarChart3,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    label: "Analytics Agent",
  },
  content: {
    icon: FileText,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    label: "Content Agent",
  },
  inventory: {
    icon: Package,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "Inventory Agent",
  },
  marketing: {
    icon: Megaphone,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    label: "Marketing Agent",
  },
  plan: {
    icon: Workflow,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    label: "Workflow Planner",
  },
};

interface AgentStepProps {
  agentName: string;
  toolName: string;
  state: string;
  args: Record<string, unknown>;
}

export function AgentStep({ agentName, toolName, state, args }: AgentStepProps) {
  const config = AGENT_CONFIG[agentName] ?? {
    icon: Bot,
    color: "text-gray-400",
    bg: "bg-gray-500/10 border-gray-500/20",
    label: agentName,
  };
  const Icon = config.icon;
  const isLoading = state !== "result";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${config.bg}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className={`font-medium text-sm ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {toolName.replace(/_/g, " ")}
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-muted-foreground" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-400" />
        )}
      </div>
      {state === "partial-call" && Object.keys(args).length > 0 && (
        <motion.pre
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 0.6 }}
          className="text-xs mt-2 font-mono overflow-hidden text-muted-foreground"
        >
          {JSON.stringify(args, null, 2)}
        </motion.pre>
      )}
    </motion.div>
  );
}
