// "Keep 100% vs pay 25%": what a year of chargeback recoveries costs with a
// percentage-fee service versus a StorePilot plan. Client-safe and pure, so the
// public /calculator page can recompute as the visitor types.

import { PLANS, type Plan } from "./billing/plans";

export interface CalculatorInput {
  disputesPerMonth: number;
  averageAmount: number; // in dollars
  winRate: number; // 0..100, share of fought disputes won
  feePercent: number; // what a contingency service keeps, e.g. 25
}

export interface CalculatorResult {
  recoveredPerYear: number;
  serviceFeePerYear: number;
  plan: Plan;
  planCostPerYear: number;
  savingsPerYear: number;
}

/** Cheapest plan whose monthly pack allowance covers the dispute volume. */
export function planForVolume(disputesPerMonth: number): Plan {
  for (const p of [PLANS.free, PLANS.growth, PLANS.pro]) {
    if (disputesPerMonth <= p.packsPerMonth) return p;
  }
  return PLANS.pro;
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export function calculate(raw: CalculatorInput): CalculatorResult {
  const disputes = clamp(raw.disputesPerMonth, 0, 10_000);
  const amount = clamp(raw.averageAmount, 0, 1_000_000);
  const winRate = clamp(raw.winRate, 0, 100) / 100;
  const fee = clamp(raw.feePercent, 0, 100) / 100;

  const recoveredPerYear = disputes * 12 * amount * winRate;
  const serviceFeePerYear = recoveredPerYear * fee;
  const plan = planForVolume(Math.ceil(disputes));
  const planCostPerYear = plan.priceUsd * 12;
  return {
    recoveredPerYear,
    serviceFeePerYear,
    plan,
    planCostPerYear,
    savingsPerYear: serviceFeePerYear - planCostPerYear,
  };
}

export const CALCULATOR_DEFAULTS: CalculatorInput = {
  disputesPerMonth: 4,
  averageAmount: 120,
  winRate: 45,
  feePercent: 25,
};
