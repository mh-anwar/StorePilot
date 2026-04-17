import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { DEMO_ORG_ID } from "@/lib/tenant";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const productId = Number(body?.productId);
  const authorName = String(body?.authorName || "").trim().slice(0, 100);
  const rating = Math.max(1, Math.min(5, Number(body?.rating) || 5));
  const title = String(body?.title || "").trim().slice(0, 200) || null;
  const reviewBody = String(body?.body || "").trim().slice(0, 2000);

  if (!productId || !authorName || !reviewBody) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await db.insert(reviews).values({
    orgId: DEMO_ORG_ID,
    productId,
    authorName,
    rating,
    title,
    body: reviewBody,
    status: "approved",
  });
  return NextResponse.json({ ok: true });
}
