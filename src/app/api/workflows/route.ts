import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/tenant";
import { nanoid } from "nanoid";
import { listStepTypes } from "@/lib/workflows/handlers";

export async function GET() {
  const session = await getSession();
  if (!session?.activeOrgId) {
    // Unauthenticated callers get an empty list — writes require a
    // real session with an active org.
    return NextResponse.json({ workflows: [] });
  }
  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.orgId, session.activeOrgId))
    .orderBy(desc(workflows.updatedAt));
  return NextResponse.json({ workflows: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.trigger || !Array.isArray(body?.steps)) {
    return NextResponse.json(
      { error: "name, trigger, and steps[] required" },
      { status: 400 }
    );
  }

  // Validate every step.type exists — prevents saving a workflow that
  // will fail at runtime on an unknown handler.
  const known = new Set(listStepTypes().map((s) => s.type));
  const unknown = (body.steps as Array<{ type: string }>)
    .map((s) => s.type)
    .filter((t) => !known.has(t));
  if (unknown.length) {
    return NextResponse.json(
      { error: `unknown step types: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  const id = "wf_" + nanoid(12);
  const [created] = await db
    .insert(workflows)
    .values({
      id,
      orgId: session.activeOrgId,
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      steps: body.steps,
      status: body.status ?? "active",
      createdBy: session.userId,
    })
    .returning();
  return NextResponse.json({ ok: true, workflow: created });
}
