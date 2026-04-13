"use client";

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

const agents: Record<string, { icon: typeof Bot; color: string; bg: string; label: string }> = {
  analytics: { icon: BarChart3, color: "text-blue-400", bg: "bg-blue-950/40 border-blue-800/30", label: "Analytics" },
  content: { icon: FileText, color: "text-purple-400", bg: "bg-purple-950/40 border-purple-800/30", label: "Content" },
  inventory: { icon: Package, color: "text-amber-400", bg: "bg-amber-950/40 border-amber-800/30", label: "Inventory" },
  marketing: { icon: Megaphone, color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800/30", label: "Marketing" },
  plan: { icon: Workflow, color: "text-cyan-400", bg: "bg-cyan-950/40 border-cyan-800/30", label: "Planner" },
};

export function AgentStep({ agentName, toolName, state, args }: {
  agentName: string;
  toolName: string;
  state: string;
  args: Record<string, unknown>;
}) {
  const cfg = agents[agentName] ?? { icon: Bot, color: "text-gray-400", bg: "bg-gray-900/40 border-gray-700/30", label: agentName };
  const Icon = cfg.icon;
  const done = state === "result" || state === "output";

  return (
    <div className={`rounded-md border p-2.5 ${cfg.bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        <span className={`font-medium text-xs ${cfg.color}`}>{cfg.label}</span>
        <span className="text-[11px] text-muted-foreground">{toolName.replace(/_/g, " ")}</span>
        {done
          ? <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-500" />
          : <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground/60" />}
      </div>
      {state === "partial-call" && Object.keys(args).length > 0 && (
        <pre className="text-[10px] mt-1.5 font-mono opacity-50 overflow-hidden text-muted-foreground leading-tight">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  );
}
