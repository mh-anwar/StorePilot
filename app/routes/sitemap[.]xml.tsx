import type { LoaderFunctionArgs } from "react-router";
import { GUIDES } from "../lib/guides";

// Public pages for search engines. The embedded app (/app) and the demo's
// write actions are left out on purpose.
export function sitemapXml(origin: string): string {
  const paths = ["/", "/demo", "/calculator", "/guides", ...GUIDES.map((g) => `/guides/${g.slug}`), "/privacy"];
  const urls = paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const loader = ({ request }: LoaderFunctionArgs) => {
  const origin = (process.env.SHOPIFY_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  return new Response(sitemapXml(origin), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
};
