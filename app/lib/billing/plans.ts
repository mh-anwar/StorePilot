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
  deadlineAlerts: boolean; // email when a dispute arrives and as its deadline nears
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
    deadlineAlerts: false,
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
    deadlineAlerts: true,
    features: ["30 evidence packs a month", "AI-written rebuttals (Claude Haiku)", "Email alerts 7, 3 and 1 day before deadlines"],
  },
  pro: {
    key: "pro",
    name: PLAN_PRO,
    label: "Pro",
    priceUsd: 79,
    packsPerMonth: Number.POSITIVE_INFINITY,
    aiDrafts: true,
    autoDraft: true,
    deadlineAlerts: true,
    features: [
      "Unlimited evidence packs",
      "AI-written rebuttals (Claude Sonnet)",
      "Packs drafted the moment a dispute arrives",
      "Email alerts 7, 3 and 1 day before deadlines",
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
