import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = String(body?.code || "").toUpperCase().trim().slice(0, 50);
  const type = String(body?.type || "percentage") as
    | "percentage"
    | "fixed_amount"
    | "free_shipping";
  const value = String(body?.value || "0");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  try {
    const [d] = await db
      .insert(discounts)
      .values({
        code,
        type,
        value,
        description: body?.description ?? null,
        minSubtotal: body?.minSubtotal ?? null,
        usageLimit: body?.usageLimit ?? null,
        active: true,
      })
      .returning();
    return NextResponse.json({
      ok: true,
      discount: {
        ...d,
        startsAt: d.startsAt ? d.startsAt.toISOString() : null,
        endsAt: d.endsAt ? d.endsAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
