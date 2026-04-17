import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { getCurrentOrgId } from "@/lib/tenant";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
  const orgId = await getCurrentOrgId();
  const [c] = await db
    .insert(collections)
    .values({ orgId, name, slug, description: body?.description ?? null })
    .returning();
  return NextResponse.json({
    ok: true,
    collection: { ...c, createdAt: c.createdAt.toISOString() },
  });
}
