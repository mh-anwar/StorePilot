import prisma from "../db.server";

// Liveness/readiness probe used by Fly and Render. Also confirms the SQLite
// database on /data is reachable, since Prisma only opens it lazily.
export async function loader() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}