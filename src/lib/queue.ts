// Tiny Postgres-backed job queue. Jobs are rows in the `jobs` table;
// workers poll with `SELECT ... FOR UPDATE SKIP LOCKED` to avoid double
// work across multiple instances. This is intentionally minimal — we're
// not trying to replace pg-boss/Sidekiq. When a real worker process
// (Railway/Fly/etc) gets added, it'll call `drainQueue()` in a loop.

import { db } from "./db";
import { jobs } from "./db/schema";
import { eq, sql } from "drizzle-orm";

export type JobKind =
  | "shopify.webhook.process"
  | "shopify.sync.products"
  | "shopify.sync.orders"
  | "shopify.sync.customers"
  | "automation.run"
  | "workflow.run"
  | "workflow.resume";

type HandlerFn = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<JobKind, HandlerFn>();

export function registerHandler(kind: JobKind, fn: HandlerFn) {
  handlers.set(kind, fn);
}

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown>,
  options: { runAt?: Date } = {}
): Promise<number> {
  const [row] = await db
    .insert(jobs)
    .values({ kind, payload, runAt: options.runAt ?? new Date() })
    .returning({ id: jobs.id });
  return row.id;
}

// Helpers for the common kinds so call sites don't stringly-type.
export const enqueueWebhookProcess = (p: {
  shopId: string;
  topic: string;
  webhookId: string;
}) => enqueue("shopify.webhook.process", p);

export const enqueueProductSync = (p: { shopId: string; cursor?: string }) =>
  enqueue("shopify.sync.products", p);

export const enqueueOrderSync = (p: { shopId: string; cursor?: string }) =>
  enqueue("shopify.sync.orders", p);

export const enqueueCustomerSync = (p: { shopId: string; cursor?: string }) =>
  enqueue("shopify.sync.customers", p);

// Pull up to N due jobs and run them. Returns the number processed.
export async function drainQueue(batchSize = 10): Promise<number> {
  let processed = 0;
  for (let i = 0; i < batchSize; i++) {
    const claim = await db.execute(sql`
      UPDATE jobs SET status = 'running', started_at = NOW(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM jobs
        WHERE status = 'pending' AND run_at <= NOW()
        ORDER BY run_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, kind, payload, attempts
    `);
    const rows =
      (claim as { rows?: Array<Record<string, unknown>> }).rows ??
      (claim as unknown as Array<Record<string, unknown>>);
    const row = rows?.[0] as
      | { id: number; kind: JobKind; payload: Record<string, unknown>; attempts: number }
      | undefined;
    if (!row) break;

    const handler = handlers.get(row.kind);
    if (!handler) {
      await db
        .update(jobs)
        .set({
          status: "failed",
          lastError: `No handler for kind ${row.kind}`,
          finishedAt: new Date(),
        })
        .where(eq(jobs.id, row.id));
      continue;
    }

    try {
      await handler(row.payload);
      await db
        .update(jobs)
        .set({ status: "succeeded", finishedAt: new Date() })
        .where(eq(jobs.id, row.id));
      processed++;
    } catch (e) {
      const err = (e as Error).message;
      const retry = row.attempts < 5;
      await db
        .update(jobs)
        .set({
          status: retry ? "pending" : "failed",
          lastError: err,
          runAt: retry
            ? new Date(Date.now() + Math.pow(2, row.attempts) * 30_000)
            : undefined,
          finishedAt: retry ? null : new Date(),
        })
        .where(eq(jobs.id, row.id));
    }
  }
  return processed;
}
