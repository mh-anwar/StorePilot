import { describe, expect, it } from "vitest";
import { calculate, CALCULATOR_DEFAULTS, planForVolume } from "../../app/lib/calculator";

describe("fee calculator", () => {
  it("picks the cheapest plan that covers the volume", () => {
    expect(planForVolume(0).key).toBe("free");
    expect(planForVolume(3).key).toBe("free");
    expect(planForVolume(4).key).toBe("growth");
    expect(planForVolume(30).key).toBe("growth");
    expect(planForVolume(31).key).toBe("pro");
  });

  it("compares a year of percentage fees with a flat plan", () => {
    const r = calculate({ disputesPerMonth: 10, averageAmount: 100, winRate: 50, feePercent: 25 });
    expect(r.recoveredPerYear).toBe(6000);
    expect(r.serviceFeePerYear).toBe(1500);
    expect(r.plan.key).toBe("growth");
    expect(r.planCostPerYear).toBe(348);
    expect(r.savingsPerYear).toBe(1152);
  });

  it("defaults show a saving, and nonsense input can't produce NaN or negatives", () => {
    expect(calculate(CALCULATOR_DEFAULTS).savingsPerYear).toBeGreaterThan(0);
    const r = calculate({ disputesPerMonth: -5, averageAmount: Number.NaN, winRate: 500, feePercent: -1 });
    expect(r.recoveredPerYear).toBe(0);
    expect(r.serviceFeePerYear).toBe(0);
    expect(r.plan.key).toBe("free");
  });
});
