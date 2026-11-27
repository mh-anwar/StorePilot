import { describe, expect, it } from "vitest";
import { REVIEW_INTERVAL_DAYS, shouldAskForReview } from "../../app/lib/onboarding";

const now = new Date("2026-11-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("asking for an App Store review", () => {
  it("waits for the first won dispute", () => {
    expect(shouldAskForReview({ won: 0, reviewRequestedAt: null, isDemo: false }, now)).toBe(false);
    expect(shouldAskForReview({ won: 1, reviewRequestedAt: null, isDemo: false }, now)).toBe(true);
  });

  it("never asks in the demo", () => {
    expect(shouldAskForReview({ won: 5, reviewRequestedAt: null, isDemo: true }, now)).toBe(false);
  });

  it(`asks again only after ${REVIEW_INTERVAL_DAYS} days`, () => {
    expect(shouldAskForReview({ won: 3, reviewRequestedAt: daysAgo(10), isDemo: false }, now)).toBe(false);
    expect(shouldAskForReview({ won: 3, reviewRequestedAt: daysAgo(REVIEW_INTERVAL_DAYS), isDemo: false }, now)).toBe(true);
  });
});
