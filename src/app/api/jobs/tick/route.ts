import { NextResponse } from "next/server";
import { drainQueue } from "@/lib/queue";
// Importing handlers registers them against the queue registry.
import "@/lib/queue/handlers";
import { fanoutSchedule } from "@/lib/workflows/triggers";
import { expireOldProposals } from "@/lib/proposal-expiry";

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
  // 1) Fan out schedule-triggered workflows whose interval is due.
  const scheduled = await fanoutSchedule();
  // 2) Expire pending proposals that sat too long.
  const { expired } = await expireOldProposals();
  // 3) Drain queued jobs (webhooks, syncs, workflow runs) in a batch.
  const processed = await drainQueue(25);
  return NextResponse.json({ ok: true, scheduled, expired, processed });
}

export const POST = GET;
