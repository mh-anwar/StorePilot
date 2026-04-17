import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const orgId = await getCurrentOrgId();
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(storeSettings)
      .values({ key, orgId, value })
      .onConflictDoUpdate({
        target: storeSettings.key,
        set: { value, updatedAt: sql`NOW()` },
      });
  }
  return NextResponse.json({ ok: true });
}
