import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { DEMO_ORG_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE stream that polls stock for a set of product IDs every few seconds
// and emits deltas. Simple poll-based pubsub — adequate for a demo store.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 200);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const last = new Map<number, number>();

      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      async function tick() {
        if (closed || ids.length === 0) return;
        try {
          const rows = await db
            .select({ id: products.id, stock: products.stock })
            .from(products)
            .where(
              and(eq(products.orgId, DEMO_ORG_ID), inArray(products.id, ids))
            );
          const changed = rows.filter((r) => last.get(r.id) !== r.stock);
          for (const r of rows) last.set(r.id, r.stock);
          if (changed.length > 0) send("stock", changed);
        } catch {
          // ignore; try again on next tick
        }
      }

      // Kick off immediately then poll every 3s. Heartbeat keeps proxies happy.
      await tick();
      const pollInterval = setInterval(tick, 3000);
      const hbInterval = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(hbInterval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
