import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { getSession } from "@/lib/tenant";
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Allow the demo dashboard to stay browseable without auth so public
  // links keep working. If a session exists, load the user + active org so
  // the sidebar can show them. Pages that mutate data pick org from
  // `getCurrentOrgId()` which falls back to org_demo when unauthenticated.
  const session = await getSession();
  let user: { name: string | null; email: string } | null = null;
  let org: { id: string; name: string } | null = null;
  if (session) {
    const [u] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, session.userId));
    user = u ?? null;
    if (session.activeOrgId) {
      const [o] = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, session.activeOrgId));
      org = o ?? null;
    }
  }
  if (!session && process.env.REQUIRE_AUTH === "1") redirect("/login");

  return (
    <div className="flex h-screen">
      <SidebarNav user={user} org={org} />
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
