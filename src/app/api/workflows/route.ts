import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentOrgId, getSession } from "@/lib/tenant";
import { nanoid } from "nanoid";

export async function GET() {
  const orgId = await getCurrentOrgId();
  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.orgId, orgId))
    .orderBy(desc(workflows.updatedAt));
  return NextResponse.json({ workflows: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  const orgId = session?.activeOrgId ?? (await getCurrentOrgId());
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.trigger || !Array.isArray(body?.steps)) {
    return NextResponse.json(
      { error: "name, trigger, and steps[] required" },
      { status: 400 }
    );
  }
  const id = "wf_" + nanoid(12);
  const [created] = await db
    .insert(workflows)
    .values({
      id,
      orgId,
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      steps: body.steps,
      status: body.status ?? "active",
      createdBy: session?.userId ?? null,
    })
    .returning();
  return NextResponse.json({ ok: true, workflow: created });
}
