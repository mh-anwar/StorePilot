# StorePilot

> The automations layer Shopify Flow should have been. With an LLM instead of if/then.

Shopify Flow is rule-based: if order tagged X, then add tag Y. Great for plumbing, useless when you actually need to think. Shopify Sidekick is conversational: it acts once, then it's done. Neither of them schedules, retries, stops for approval, or reasons about an order the way a human would.

StorePilot is a workflow engine for Shopify where **any step can be an LLM**, **any step can pause for approval**, and everything that happens lives in an audit log your ops team can trust.

## What a workflow looks like

```
trigger:        orders/create
├─ step 1  llm.reason     score this order for fraud risk
├─ step 2  condition      steps.analyze.output.fraud_score > 0.6
├─ step 3  proposal.gate  flag customer 'fraud-review' (awaits approval)
└─ step 4  notify.email   ping ops@company.com
```

Five built-in step types cover most of what merchants ask for:

- **`llm.reason`** / **`llm.classify`** — call a model with a structured-output schema. The result is typed JSON downstream steps reference as `{{steps.analyze.output.fraud_score}}`.
- **`condition`** — a tiny expression evaluator (`>`, `<`, `==`, `&&`, `||`, etc.) against the trigger and previous steps. A false condition halts the workflow cleanly.
- **`store.*`** — first-class Shopify Admin API writes: `update_inventory`, `update_price`, `create_discount`, `tag_customer`, `fetch_order`, `low_stock_report`. Actions route to Shopify when the store is connected; fall back to the native DB otherwise.
- **`notify.*`** / **`http.request`** — email (Resend), Slack webhook, arbitrary outbound HTTP.
- **`proposal.gate`** — stops the workflow and routes the proposed action to your Proposals inbox with full context and LLM rationale. Approve → it runs. Reject → the run continues with the gate skipped.

Triggers: **manual**, **schedule** (every N minutes), **shopify event** (any webhook topic), **http webhook** (per-workflow token).

## Things you cannot build in Flow

- Fraud triage that reads the shipping address like a human and routes suspicious orders.
- A daily restock plan that proposes order quantities based on velocity and a merchant's notes, with approval before a PO ever sends.
- Tone-matched replies to bad reviews, with a proposed refund the merchant can one-click approve.
- A slow-mover discount generator that picks the SKUs, writes the code, and drafts the Klaviyo email.
- A VIP pipeline: the moment an order crosses a threshold, tag, email, and generate a one-time code — all from reasoning, not if/then.

## Why it's not Shopify Flow, Sidekick, or Zapier

| | them | us |
|---|---|---|
| Shopify Flow | rules only, no LLM, no reasoning | LLM-first, structured outputs pipe downstream |
| Shopify Sidekick | conversational, acts once | persistent workflows, triggers, retries, audit log |
| Zapier + GPT block | generic, no Shopify-aware writes, no approvals | first-class Admin API actions, proposals inbox |

## Trust

Autonomous where you want it, supervised where it counts.

- **Proposals inbox** — any step marked `requiresApproval` stops the run, posts the resolved action config to a queue, and waits. Merchants approve or reject; the run continues.
- **Audit log** — every write an agent makes lands in `audit_log` with the actor, the tool, the args, the result.
- **Versioned workflows** — every save bumps the version; runs are pinned to the version that executed them. You can see what rule produced a change a month ago.

## Running locally

```bash
pnpm install
cp .env.example .env.local                   # DATABASE_URL, APP_ENCRYPTION_KEY, SESSION_SECRET
pnpm tsx scripts/migrate-tenancy.ts          # tenancy tables
pnpm tsx scripts/migrate-new-tables.ts       # store tables
pnpm tsx scripts/migrate-jobs.ts             # job queue
pnpm tsx scripts/migrate-workflows.ts        # workflow engine
pnpm db:seed                                 # demo products/orders/customers
pnpm dev
```

Then:

- [/](http://localhost:3000) — the pitch
- [/signup](http://localhost:3000/signup) — create a workspace
- [/dashboard/workflows](http://localhost:3000/dashboard/workflows) — build and run
- [/dashboard/proposals](http://localhost:3000/dashboard/proposals) — approve actions
- [/dashboard/shopify](http://localhost:3000/dashboard/shopify) — connect a Shopify store
- [/shop](http://localhost:3000/shop) — the demo storefront (so you can generate real orders against the mirror)

## Architecture at a glance

```
Shopify webhook ──► HMAC-verified /api/shopify/webhooks
                         │
                         ▼
              webhook_events + jobs (pg)
                         │
                         ▼
           worker drains queue
                         │           ┌──────────────────────────┐
                         └──────────►│ workflow fanout           │
                                     │  trigger = shopify+topic  │
                                     └───────────┬──────────────┘
                                                 ▼
                            runWorkflow: resolve config → step handlers
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
              llm.reason                   store.update_*                 proposal.gate
            (structured JSON)             (Shopify Admin API)            (human inbox)
                                                                              │
                                                         approve ─────────────┘
                                                         → resume run
```

## Stack

Next.js 16 · TypeScript · Vercel AI SDK v6 · Claude Sonnet 4 · Drizzle ORM on Neon Postgres · Tailwind v4 · Postgres-backed job queue with `FOR UPDATE SKIP LOCKED`.

## A few honest notes

- The worker is `/api/jobs/tick`. In production, point a cron at it every minute or run a long-lived worker.
- "Run now" for workflows is inline (synchronous) for fast UI feedback; triggered runs go through the queue.
- HMAC-verified Shopify webhook ingestion is wired, but you need a Shopify Partner app to get `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` and a public `APP_URL`.
- The app's own storefront is a *demo* — it shares the DB with the workflow engine so you can generate real orders and see workflows react.

## License

MIT.
