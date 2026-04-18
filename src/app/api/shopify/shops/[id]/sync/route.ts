import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shops } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/tenant";
import {
  enqueueProductSync,
  enqueueCustomerSync,
  enqueueOrderSync,
} from "@/lib/queue";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const [s] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.id, id), eq(shops.orgId, session.activeOrgId)));
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  await enqueueProductSync({ shopId: s.id });
  await enqueueCustomerSync({ shopId: s.id });
  await enqueueOrderSync({ shopId: s.id });
  return NextResponse.json({ ok: true, enqueued: 3 });
}
