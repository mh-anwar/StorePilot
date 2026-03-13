"use client";

import { motion } from "framer-motion";

interface ToolResultCardProps {
  toolName: string;
  result: unknown;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    // Try to format as currency
    const num = parseFloat(value);
    if (!isNaN(num) && value.match(/^\d+\.?\d*$/)) {
      return num >= 1000
        ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : num.toString();
    }
    return value;
  }
  return JSON.stringify(value);
}

function SimpleTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No results</p>;

  const keys = Object.keys(data[0]).filter(
    (k) => typeof data[0][k] !== "object"
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50">
            {keys.map((key) => (
              <th
                key={key}
                className="text-left px-2 py-1.5 font-medium text-muted-foreground capitalize"
              >
                {key.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b border-border/30">
              {keys.map((key) => (
                <td key={key} className="px-2 py-1.5">
                  {formatValue(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <p className="text-xs text-muted-foreground mt-1">
          ...and {data.length - 10} more rows
        </p>
      )}
    </div>
  );
}

export function ToolResultCard({ toolName, result }: ToolResultCardProps) {
  if (!result || typeof result === "string") {
    return (
      <div className="text-sm text-muted-foreground">
        {String(result || "No result")}
      </div>
    );
  }

  const data = result as Record<string, unknown>;

  // Check if result contains an array we can tabulate
  const arrayKey = Object.keys(data).find(
    (k) => Array.isArray(data[k]) && (data[k] as unknown[]).length > 0
  );

  if (data.error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
        {String(data.error)}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="bg-muted/30 rounded-lg p-3 mt-1 space-y-2"
    >
      {Object.entries(data)
        .filter(([, v]) => !Array.isArray(v) && typeof v !== "object")
        .map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground capitalize">
              {key.replace(/_/g, " ")}:
            </span>
            <span className="font-medium">{formatValue(value)}</span>
          </div>
        ))}

      {arrayKey ? (
        <SimpleTable
          data={data[arrayKey] as Record<string, unknown>[]}
        />
      ) : null}

      {data.generatedDescription ? (
        <div className="bg-background rounded p-3 text-sm border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Generated Description:</p>
          <p>{String(data.generatedDescription)}</p>
        </div>
      ) : null}

      {data.email && typeof data.email === "object" ? (
        <div className="bg-background rounded p-3 text-sm border border-border/50 space-y-2">
          <p className="font-medium">
            {String((data.email as Record<string, unknown>).subjectLine || "")}
          </p>
          <p className="text-xs text-muted-foreground">
            {String((data.email as Record<string, unknown>).previewText || "")}
          </p>
          <p className="text-sm">
            {String((data.email as Record<string, unknown>).body || "")}
          </p>
        </div>
      ) : null}

      {data.steps && Array.isArray(data.steps) ? (
        <div className="space-y-1">
          {(data.steps as Array<Record<string, unknown>>).map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5 border border-border/30"
            >
              <span className="font-mono text-muted-foreground w-5">
                {String(step.stepNumber)}.
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {String(step.agent)}
              </span>
              <span>{String(step.action)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
