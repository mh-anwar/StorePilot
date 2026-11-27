import type { LoaderFunctionArgs } from "react-router";

// Let search engines index the public pages, not the embedded app or auth.
export const loader = ({ request }: LoaderFunctionArgs) => {
  const origin = (process.env.SHOPIFY_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Disallow: /app",
    "Disallow: /auth",
    "Disallow: /webhooks",
    "Disallow: /cron",
    "Allow: /",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
