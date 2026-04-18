import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  isConfigured,
  shopDomainIsValid,
} from "@/lib/shopify/config";
import { verifyOAuthHmac } from "@/lib/shopify/hmac";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { putSecret } from "@/lib/crypto";
import { getSession } from "@/lib/tenant";
import { nanoid } from "nanoid";
import { registerWebhooks } from "@/lib/shopify/webhooks";

// Step 2 of OAuth: Shopify redirects here with ?code=&hmac=&state=&shop=.
// We verify the HMAC, exchange the code for a permanent offline access
// token, encrypt it, and persist a shops row for this org.
export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Shopify not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  const { code, shop, state } = params;

  if (!code || !shop || !shopDomainIsValid(shop)) {
    return NextResponse.json({ error: "invalid callback" }, { status: 400 });
  }
  if (!verifyOAuthHmac(params)) {
    return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });
  }

  const jar = await cookies();
  const expectedState = jar.get("sp_shopify_nonce")?.value;
  const expectedShop = jar.get("sp_shopify_shop")?.value;
  if (!expectedState || expectedState !== state || expectedShop !== shop) {
    return NextResponse.json({ error: "state mismatch" }, { status: 401 });
  }
  jar.delete("sp_shopify_nonce");
  jar.delete("sp_shopify_shop");

  const session = await getSession();
  const orgId = session?.activeOrgId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/shopify", req.url));
  }

  // Exchange auth code for a permanent access token
  const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    return NextResponse.json(
      { error: "token exchange failed", detail: body },
      { status: 502 }
    );
  }
  const { access_token: accessToken, scope } = (await tokenResp.json()) as {
    access_token: string;
    scope: string;
  };

  // Upsert shop row
  const [existing] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.shopDomain, shop), eq(shops.platform, "shopify")));
  const shopId = existing?.id ?? "shp_" + nanoid(12);
  if (existing) {
    await db
      .update(shops)
      .set({
        orgId,
        scope,
        status: "active",
        installedAt: new Date(),
      })
      .where(eq(shops.id, existing.id));
  } else {
    await db.insert(shops).values({
      id: shopId,
      orgId,
      platform: "shopify",
      shopDomain: shop,
      scope,
      status: "active",
      installedAt: new Date(),
    });
  }

  // Store the token under a stable per-shop key
  await putSecret(orgId, `shopify:${shopId}:token`, accessToken);

  // Register core webhooks (fire-and-forget — any errors land in logs)
  registerWebhooks(shop, accessToken).catch((e) =>
    console.error("webhook register failed", e)
  );

  return NextResponse.redirect(
    new URL(`/dashboard/shopify/${shopId}?installed=1`, req.url)
  );
}
