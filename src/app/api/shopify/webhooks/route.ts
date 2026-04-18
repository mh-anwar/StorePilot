import { NextResponse } from "next/server";
import { verifyWebhookHmac } from "@/lib/shopify/hmac";
import { db } from "@/lib/db";
import { shops, webhookEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { enqueueWebhookProcess } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const topic = req.headers.get("x-shopify-topic") || "";
  const shop = req.headers.get("x-shopify-shop-domain") || "";
  const webhookId = req.headers.get("x-shopify-webhook-id") || "";
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";

  if (!verifyWebhookHmac(raw, hmac)) {
    return NextResponse.json({ error: "invalid hmac" }, { status: 401 });
  }
  if (!topic || !shop || !webhookId) {
    return NextResponse.json({ error: "missing headers" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.shopDomain, shop), eq(shops.platform, "shopify")));
  if (!row) {
    // Shop isn't registered — ack anyway to stop Shopify retrying, but log.
    console.warn(`webhook received for unknown shop ${shop} (topic=${topic})`);
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  // Idempotency: webhook_events has a UNIQUE(shop_id, webhook_id) and we
  // noop on conflict. Shopify may retry the same webhook.
  try {
    await db
      .insert(webhookEvents)
      .values({ shopId: row.id, webhookId, topic, payload: payload as object })
      .onConflictDoNothing();
  } catch (e) {
    console.error("webhook persist failed", (e as Error).message);
  }

  // Async work happens out of the request (queue). Ack within 5s per Shopify.
  enqueueWebhookProcess({ shopId: row.id, topic, webhookId }).catch(() => {});

  return NextResponse.json({ ok: true });
}
