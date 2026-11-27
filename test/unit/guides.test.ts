import { describe, expect, it } from "vitest";
import { DISPUTE_REASONS } from "../../app/lib/disputes/types";
import { guideBySlug, guideJsonLd, GUIDES } from "../../app/lib/guides";
import { sitemapXml } from "../../app/routes/sitemap[.]xml";

describe("chargeback guides", () => {
  it("have unique, URL-safe slugs and search-friendly descriptions", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      expect(g.description.length, g.slug).toBeLessThanOrEqual(160);
      expect(g.evidence.length, g.slug).toBeGreaterThanOrEqual(3);
      for (const r of g.reasons) expect(DISPUTE_REASONS).toContain(r);
    }
  });

  it("cover each reason at most once", () => {
    const reasons = GUIDES.flatMap((g) => g.reasons);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("are found by slug", () => {
    expect(guideBySlug("fraudulent")?.reasons).toContain("UNRECOGNIZED");
    expect(guideBySlug("nope")).toBeUndefined();
  });

  it("are all in the sitemap", () => {
    const xml = sitemapXml("https://storepilot.example");
    for (const g of GUIDES) expect(xml).toContain(`<loc>https://storepilot.example/guides/${g.slug}</loc>`);
    expect(xml).not.toContain("/app");
  });
});

it("guide structured data is an Article that can't break out of its script tag", () => {
  const g = { ...GUIDES[0], title: "A </script> title" };
  const raw = guideJsonLd(g, "https://storepilot.example/guides/x");
  expect(raw).not.toContain("<");
  expect(JSON.parse(raw)).toMatchObject({ "@type": "Article", headline: "A </script> title" });
});
