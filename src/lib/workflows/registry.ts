// Singleton registry of step handlers. Keeping this module separate from
// handlers.ts keeps the executor free of any particular handler's deps —
// handlers.ts imports the registry and calls register*() at import time.
import type { StepHandler, StepHandlerInfo } from "./types";

const registry = new Map<string, StepHandlerInfo>();

export function registerStep(type: string, info: StepHandlerInfo) {
  if (registry.has(type)) return;
  registry.set(type, info);
}

export function getHandler(type: string): StepHandler | undefined {
  return registry.get(type)?.handler;
}

export function listStepTypes(): Array<{
  type: string;
  category: string;
  description: string;
}> {
  return Array.from(registry.entries())
    .map(([type, info]) => ({
      type,
      category: info.category,
      description: info.description,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.type.localeCompare(b.type));
}
