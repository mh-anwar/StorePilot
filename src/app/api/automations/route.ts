import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { getCurrentOrgId } from "@/lib/tenant";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const prompt = String(body?.prompt || "").trim();
  if (!name || !prompt)
    return NextResponse.json({ error: "name + prompt required" }, { status: 400 });

  const orgId = await getCurrentOrgId();
  const [a] = await db
    .insert(automations)
    .values({
      orgId,
      name,
      description: body?.description ?? null,
      prompt,
      trigger: body?.trigger ?? "manual",
      triggerConfig: body?.triggerConfig ?? {},
    })
    .returning();

  return NextResponse.json({
    ok: true,
    automation: {
      ...a,
      createdAt: a.createdAt.toISOString(),
      lastRunAt: null,
    },
  });
}
