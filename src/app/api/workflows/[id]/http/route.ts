// HTTP-triggered workflow entry point. Callers authenticate with a
// per-workflow token set in the trigger config; the body becomes the
// workflow's trigger_data. Handy for integrating with tools that emit
// webhooks (Zapier, Make, Klaviyo, etc.).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runFromHttp } from "@/lib/workflows/triggers";
import "@/lib/workflows/handlers";
import { enqueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, id: string) {
  const [wf] = await db.select().from(workflows).where(eq(workflows.id, id));
  if (!wf) return NextResponse.json({ error: "not found" }, { status: 404 });
  const trigger = wf.trigger as { type: string; token?: string };
  if (trigger.type !== "http") {
    return NextResponse.json({ error: "not an http-triggered workflow" }, { status: 400 });
  }
  const token = new URL(req.url).searchParams.get("token") || req.headers.get("x-trigger-token");
  if (!trigger.token || token !== trigger.token) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { runId } = await runFromHttp({
    workflowId: wf.id,
    orgId: wf.orgId,
    body: body as Record<string, unknown>,
  });
  // Ensure the tick runs it on the next cycle if the worker isn't inline.
  await enqueue("workflow.run", { runId });
  return NextResponse.json({ ok: true, runId });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, id);
}
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, id);
}
