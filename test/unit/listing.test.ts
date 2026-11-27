// Keeps the App Store listing copy in docs/APP_STORE_LISTING.md inside
// Shopify's field limits, and its pricing in step with the plan definitions.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "../../app/lib/billing/plans";

const doc = readFileSync("docs/APP_STORE_LISTING.md", "utf8");

function block(name: string) {
  const start = doc.indexOf(`<!-- listing:${name} `);
  if (start < 0) throw new Error(`listing block ${name} missing`);
  const open = doc.indexOf("-->", start) + 3;
  const close = doc.indexOf("<!-- /listing -->", open);
  return doc.slice(open, close).trim();
}
const items = (body: string) =>
  body
    .split("\n")
    .map((l) => l.replace(/^- /, "").trim())
    .filter(Boolean);

describe("App Store listing copy", () => {
  it.each([
    ["name", 30],
    ["subtitle", 62],
    ["introduction", 100],
    ["details", 500],
  ] as const)("%s fits in %i characters", (name, max) => {
    const body = block(name);
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(max);
  });

  it("has 3 to 5 features of 80 characters at most", () => {
    const features = items(block("features"));
    expect(features.length).toBeGreaterThanOrEqual(3);
    expect(features.length).toBeLessThanOrEqual(5);
    for (const f of features) expect(f.length, f).toBeLessThanOrEqual(80);
  });

  it("has 5 search terms of 20 characters at most", () => {
    const terms = items(block("search"));
    expect(terms).toHaveLength(5);
    for (const t of terms) expect(t.length, t).toBeLessThanOrEqual(20);
  });

  it("keeps prices out of the name, subtitle and introduction", () => {
    for (const name of ["name", "subtitle", "introduction"]) {
      expect(block(name)).not.toMatch(/\$|free|price/i);
    }
  });

  it("lists the same prices as the plans", () => {
    for (const p of [PLANS.growth, PLANS.pro]) expect(doc).toContain(`$${p.priceUsd}/month`);
  });
});
