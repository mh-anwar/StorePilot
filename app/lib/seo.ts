// Shared bits for public pages' search and social previews.

/** The public origin, preferring the configured app URL over the request (proxies may rewrite it). */
export function publicOrigin(request: Request): string {
  return (process.env.SHOPIFY_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

/** Open Graph + Twitter image tags. Crawlers need an absolute image URL. */
export function socialImage(origin: string | undefined) {
  const image = `${origin ?? ""}/og.png`;
  return [
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
}
