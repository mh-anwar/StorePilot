// Invite a user to the org by email (they must have a StorePilot
// account already; a full invite-by-email-with-signup flow is a follow
// up). List members for the owner to see who has access.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/tenant";

async function assertOwner(orgId: string, userId: string) {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  if (!m) throw new Error("not a member");
  if (m.role !== "owner" && m.role !== "admin")
    throw new Error("only owners/admins can invite");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // List requires at least membership.
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, id), eq(memberships.userId, session.userId)));
  if (!m) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, id));
  return NextResponse.json({ members: rows });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertOwner(id, session.userId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").toLowerCase().trim();
  const role = (body?.role as "admin" | "staff") ?? "staff";
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) {
    return NextResponse.json(
      {
        error:
          "User doesn't exist yet. Ask them to sign up first — we'll add proper email invites in a follow-up.",
      },
      { status: 400 }
    );
  }

  await db
    .insert(memberships)
    .values({ userId: u.id, orgId: id, role })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
