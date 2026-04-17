// Tenant context — resolves the current org for a request.
//
// Priority:
//   1. Session cookie (set on login) with an active_org_id
//   2. "org_demo" fallback (keeps the public /shop demo working while
//      unauthenticated and while we're still wiring auth everywhere)
//
// The auth module rewrites this by setting a session cookie after login.
// API routes that must be tenant-scoped should call `requireOrgId()` which
// throws 401 when no real org context is present.

import { cookies } from "next/headers";
import { db } from "./db";
import { userSessions } from "./db/schema";
import { eq, gt, and } from "drizzle-orm";

export const DEMO_ORG_ID = "org_demo";
export const SESSION_COOKIE = "sp_session";

export async function getSession() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const [row] = await db
    .select()
    .from(userSessions)
    .where(
      and(eq(userSessions.id, sid), gt(userSessions.expiresAt, new Date()))
    );
  return row ?? null;
}

export async function getCurrentOrgId(): Promise<string> {
  const s = await getSession();
  return s?.activeOrgId ?? DEMO_ORG_ID;
}

export async function requireOrgId(): Promise<string> {
  const s = await getSession();
  if (!s?.activeOrgId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return s.activeOrgId;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) throw new Response("Unauthorized", { status: 401 });
  return s;
}
