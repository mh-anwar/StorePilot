// Plan limits. Safe to import from client code.
import { PLAN_GROWTH, PLAN_PRO } from "./plan-names";

export type PlanKey = "free" | "growth" | "pro";

export interface Plan {
  key: PlanKey;
  name: string; // name registered with the Billing API ("" for free)
  label: string;
  priceUsd: number;
  packsPerMonth: number; // Infinity = unlimited
  aiDrafts: boolean;
  autoDraft: boolean; // build + draft a pack as soon as a dispute arrives
  features: string[];
}

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "",
    label: "Free",
    priceUsd: 0,
    packsPerMonth: 3,
    aiDrafts: false,
    autoDraft: false,
    features: ["3 evidence packs a month", "Fight-or-accept recommendation", "Template drafts"],
  },
  growth: {
    key: "growth",
    name: PLAN_GROWTH,
    label: "Growth",
    priceUsd: 29,
    packsPerMonth: 30,
    aiDrafts: true,
    autoDraft: false,
    features: ["30 evidence packs a month", "AI-written rebuttals (Claude Haiku)", "Deadline alerts on the dashboard"],
  },
  pro: {
    key: "pro",
    name: PLAN_PRO,
    label: "Pro",
    priceUsd: 79,
    packsPerMonth: Number.POSITIVE_INFINITY,
    aiDrafts: true,
    autoDraft: true,
    features: [
      "Unlimited evidence packs",
      "AI-written rebuttals (Claude Sonnet)",
      "Packs drafted the moment a dispute arrives",
    ],
  },
};

export function planFor(key: string | null | undefined): Plan {
  return PLANS[(key as PlanKey) ?? "free"] ?? PLANS.free;
}

export function planKeyFromName(name: string | null | undefined): PlanKey {
  if (name === PLAN_PRO) return "pro";
  if (name === PLAN_GROWTH) return "growth";
  return "free";
}

/** Usage is counted per calendar month in UTC. */
export function periodKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function packsRemaining(plan: Plan, used: number): number {
  return Math.max(0, plan.packsPerMonth - used);
}
