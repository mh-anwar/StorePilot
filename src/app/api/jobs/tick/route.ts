import { NextResponse } from "next/server";
import { drainQueue } from "@/lib/queue";
// Importing handlers registers them against the queue registry.
import "@/lib/queue/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Cron-ish endpoint: call this from a scheduler (Vercel cron, Trigger.dev,
// or an external pinger) every minute to drain pending jobs. Protected by
// a shared secret so random traffic can't trigger background work.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("x-tick-secret");
  if (process.env.TICK_SECRET && secret !== process.env.TICK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const count = await drainQueue(25);
  return NextResponse.json({ ok: true, processed: count });
}

export const POST = GET;
