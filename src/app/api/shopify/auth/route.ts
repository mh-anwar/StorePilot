import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  SHOPIFY_API_KEY,
  SHOPIFY_SCOPES,
  APP_URL,
  isConfigured,
  shopDomainIsValid,
} from "@/lib/shopify/config";
import { cookies } from "next/headers";

// Step 1 of OAuth: user clicks "Connect Shopify" → we redirect them to
// Shopify's OAuth screen with a nonce we'll check on callback.
export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Shopify not configured. Set SHOPIFY_API_KEY / SHOPIFY_API_SECRET." },
      { status: 500 }
    );
  }
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop")?.toLowerCase().trim() || "";
  if (!shopDomainIsValid(shop)) {
    return NextResponse.json(
      { error: "Invalid shop domain (expected <name>.myshopify.com)" },
      { status: 400 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("sp_shopify_nonce", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  jar.set("sp_shopify_shop", shop, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const redirectUri = `${APP_URL}/api/shopify/callback`;
  const authUrl =
    `https://${shop}/admin/oauth/authorize?` +
    new URLSearchParams({
      client_id: SHOPIFY_API_KEY,
      scope: SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
      "grant_options[]": "",
    }).toString();

  return NextResponse.redirect(authUrl);
}
