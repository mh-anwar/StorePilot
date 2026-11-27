import { expect, it } from "vitest";
import { faqJsonLd } from "../../app/routes/_index/route";

it("landing page FAQ structured data is valid FAQPage JSON and can't break out of its script tag", () => {
  const raw = faqJsonLd();
  expect(raw).not.toContain("<");
  const data = JSON.parse(raw);
  expect(data["@type"]).toBe("FAQPage");
  expect(data.mainEntity.length).toBeGreaterThanOrEqual(3);
  for (const q of data.mainEntity) {
    expect(q["@type"]).toBe("Question");
    expect(q.name.length).toBeGreaterThan(5);
    expect(q.acceptedAnswer.text.length).toBeGreaterThan(10);
  }
});
