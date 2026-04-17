// Lightweight email+password auth. scrypt password hashing (built-in Node),
// random session ids stored in Postgres, set as an HttpOnly cookie. No
// third-party auth library — this stays small and obvious.

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { users, userSessions, memberships, organizations } from "./db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { SESSION_COOKIE } from "./tenant";

const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt") return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type SignupInput = {
  email: string;
  password: string;
  name?: string;
  orgName?: string;
};

export async function signup(input: SignupInput) {
  const email = input.email.toLowerCase().trim();
  if (!email || !input.password || input.password.length < 8) {
    throw new Error("Email and a password of 8+ characters are required.");
  }

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) throw new Error("An account with that email exists.");

  const userId = "usr_" + nanoid(16);
  await db.insert(users).values({
    id: userId,
    email,
    name: input.name ?? null,
    passwordHash: hashPassword(input.password),
  });

  // Every new user gets their own org as owner. Org name defaults to the
  // email local-part + " Co." — friendly enough to live with until they
  // rename it in settings.
  const orgId = "org_" + nanoid(12);
  const slug =
    (input.orgName || email.split("@")[0])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "org";
  await db.insert(organizations).values({
    id: orgId,
    slug: slug + "-" + nanoid(5).toLowerCase(),
    name: input.orgName || `${email.split("@")[0]}'s store`,
  });
  await db.insert(memberships).values({
    userId,
    orgId,
    role: "owner",
  });

  await createSession(userId, orgId);
  return { userId, orgId };
}

export async function login(email: string, password: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()));
  if (!u) throw new Error("Invalid email or password.");
  if (!verifyPassword(password, u.passwordHash))
    throw new Error("Invalid email or password.");

  const [mem] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, u.id));
  await createSession(u.id, mem?.orgId ?? null);
  return { userId: u.id, orgId: mem?.orgId ?? null };
}

export async function logout() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    try {
      await db.delete(userSessions).where(eq(userSessions.id, sid));
    } catch {}
    jar.delete(SESSION_COOKIE);
  }
}

async function createSession(userId: string, activeOrgId: string | null) {
  const id = "sid_" + randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(userSessions).values({
    id,
    userId,
    activeOrgId,
    expiresAt,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function switchOrg(orgId: string) {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) throw new Error("not logged in");
  // Verify the user actually belongs to this org before switching.
  const [sess] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.id, sid));
  if (!sess) throw new Error("not logged in");
  const [mem] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, sess.userId));
  if (!mem || mem.orgId !== orgId) throw new Error("no access to org");
  await db
    .update(userSessions)
    .set({ activeOrgId: orgId })
    .where(eq(userSessions.id, sid));
}
