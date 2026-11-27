import { afterEach, expect, it } from "vitest";
import { publicOrigin, socialImage } from "../../app/lib/seo";

afterEach(() => {
  delete process.env.SHOPIFY_APP_URL;
});

it("uses the configured app URL over the request origin, without a trailing slash", () => {
  expect(publicOrigin(new Request("http://internal:3000/guides"))).toBe("http://internal:3000");
  process.env.SHOPIFY_APP_URL = "https://storepilot.example/";
  expect(publicOrigin(new Request("http://internal:3000/guides"))).toBe("https://storepilot.example");
});

it("gives crawlers an absolute 1200x630 image and a large Twitter card", () => {
  const tags = socialImage("https://storepilot.example");
  expect(tags).toContainEqual({ property: "og:image", content: "https://storepilot.example/og.png" });
  expect(tags).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
});
