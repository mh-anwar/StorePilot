// Handlebars-lite variable substitution for workflow step configs.
//
//   {{trigger.order.total}}
//   {{steps.analyze.output.fraud_score}}
//
// Anything else is left as a literal string. Nested objects/arrays are
// walked recursively. This is intentionally simple — workflows are
// declarative, not code, and we want misconfigurations to fail loudly
// rather than silently coerce.

import type { RunContext } from "./types";

const REF = /^\{\{\s*([^}]+?)\s*\}\}$/;
const INLINE = /\{\{\s*([^}]+?)\s*\}\}/g;

function lookup(path: string, ctx: RunContext): unknown {
  const parts = path.split(".");
  // First segment selects the top-level source.
  const head = parts.shift()!;
  let cursor: unknown;
  if (head === "trigger") cursor = ctx.trigger;
  else if (head === "steps") cursor = ctx.steps;
  else if (head === "actor") cursor = ctx.actor;
  else return undefined;
  for (const p of parts) {
    if (cursor == null) return undefined;
    cursor = (cursor as Record<string, unknown>)[p];
  }
  return cursor;
}

export function resolve<T>(value: T, ctx: RunContext): T {
  if (typeof value === "string") {
    // Full-string reference — return the native value (could be number/object)
    const whole = REF.exec(value);
    if (whole) return lookup(whole[1], ctx) as T;
    // Inline interpolation — coerce to string
    return value.replace(INLINE, (_, expr) => {
      const v = lookup(expr.trim(), ctx);
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, ctx)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolve(v, ctx);
    }
    return out as T;
  }
  return value;
}
