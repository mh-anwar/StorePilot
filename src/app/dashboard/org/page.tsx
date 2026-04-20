import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  memberships,
  organizations,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/tenant";
import { OrgsPanel } from "@/components/dashboard/orgs-panel";

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/org");

  const myOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, session.userId));

  const members = session.activeOrgId
    ? await db
        .select({
          userId: users.id,
          email: users.email,
          name: users.name,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(eq(memberships.orgId, session.activeOrgId))
    : [];

  const myRole = members.find((m) => m.userId === session.userId)?.role;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          Switch orgs, invite teammates, create new workspaces.
        </p>
      </div>

      <OrgsPanel
        orgs={myOrgs}
        activeOrgId={session.activeOrgId ?? null}
        members={members}
        myRole={(myRole as "owner" | "admin" | "staff" | undefined) ?? null}
      />
    </div>
  );
}

// Keep `and` referenced so the import doesn't trip the unused-import rule
// while we add role-based checks below in a follow-up.
void and;
