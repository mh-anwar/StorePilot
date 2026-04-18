import { createHmac, timingSafeEqual } from "crypto";
import { SHOPIFY_API_SECRET } from "./config";

// OAuth callback query-string HMAC check. Shopify signs all parameters
// except `hmac` and `signature`, joined as key=value sorted and &-joined,
// using SHA-256 hex.
export function verifyOAuthHmac(params: Record<string, string>): boolean {
  const { hmac, signature: _sig, ...rest } = params;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const computed = createHmac("sha256", SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(hmac, "hex"),
      Buffer.from(computed, "hex")
    );
  } catch {
    return false;
  }
}

// Webhook payload HMAC check. Shopify signs the *raw body* with base64
// SHA-256, passed in the X-Shopify-Hmac-Sha256 header.
export function verifyWebhookHmac(rawBody: string, headerHmac: string): boolean {
  if (!headerHmac) return false;
  const computed = createHmac("sha256", SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return timingSafeEqual(Buffer.from(headerHmac), Buffer.from(computed));
  } catch {
    return false;
  }
}
