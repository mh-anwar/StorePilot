import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, memberships, users, userSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/tenant";

// List orgs the signed-in user belongs to, and optionally create one.

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      role: memberships.role,
      active: eq(organizations.id, session.activeOrgId ?? ""),
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, session.userId));
  return NextResponse.json({ orgs: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const id = "org_" + nanoid(12);
  const slugBase =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    "org";
  await db.insert(organizations).values({
    id,
    name,
    slug: `${slugBase}-${nanoid(5).toLowerCase()}`,
  });
  await db.insert(memberships).values({
    userId: session.userId,
    orgId: id,
    role: "owner",
  });
  // Switch the user to the new org so they land in it after creation.
  await db
    .update(userSessions)
    .set({ activeOrgId: id })
    .where(eq(userSessions.id, session.id));
  // Suppress unused import warning for `users` which is only referenced
  // in the list endpoint's type surface.
  void users;
  return NextResponse.json({ ok: true, id });
}
