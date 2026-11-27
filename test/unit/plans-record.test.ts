import { expect, it } from "vitest";
import { recordLine } from "../../app/components/PlansView";

const base = { recoveredCents: 0, won: 0, unanswered: 0, unansweredCents: 0, atStakeCents: 0, open: 0, currencyCode: "USD" };

it("says nothing for a store with no disputes", () => {
  expect(recordLine(base)).toBeNull();
  expect(recordLine(undefined)).toBeNull();
});

it("puts the store's own numbers in one sentence", () => {
  expect(recordLine({ ...base, open: 2, atStakeCents: 82600, unanswered: 1, unansweredCents: 14200, won: 1, recoveredCents: 26400 })).toBe(
    "$826.00 is at stake in 2 open disputes; $142.00 was lost to disputes nobody answered; you have won back $264.00 in disputes.",
  );
  expect(recordLine({ ...base, won: 1, recoveredCents: 26400 })).toBe("You have won back $264.00 in disputes.");
});
