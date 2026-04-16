# StorePilot

> Running a shop is boring glue work — this is what happens when you hand the glue to a few agents.

StorePilot is a demo of what a small Shopify-style merchant could have if agents actually did the job instead of just talking about it. There's a public shop people can browse and check out on. There's a merchant desk. And there's a chat where four specialized agents sit on real data and answer real questions — then automations that run those agents on a schedule and log what they did.

It's a side project, not a SaaS. But it's the kind of side project I want to be able to walk someone through without caveats.

---

## What's in the box

**A storefront shoppers can actually use.** Product catalog, search, PDP with reviews, cart with discount codes, checkout that writes a real order and decrements real stock. Stock updates stream live via SSE so two people on two tabs see inventory move as it moves.

**A merchant desk.** Orders, products, customers, collections, discounts, review moderation, analytics, settings. Nothing fancy — the kind of plain tables and small forms that actually ship.

**Four agents with real tools.**

- **Analytics** — revenue trends, top products, customer segments, traffic, anomaly detection
- **Content** — descriptions, SEO, pricing suggestions, bulk listing work
- **Inventory** — stock monitoring, restock recs, demand forecasts, direct updates
- **Marketing** — campaigns, email copy, social posts, discount strategies

All tools are flat-mapped and namespaced (`analytics__query_revenue`, etc.) into a single orchestrator so there's no nested-LLM latency trap. The supervisor plans, delegates, and reports.

**Automations.** Plain-English jobs — "every morning, list the five lowest-stock SKUs and draft a restock email" — saved, pinned to a trigger, runnable on demand, with a history log that keeps tool calls and output around.

**Bring your own key.** The chat will gladly use a server-side Anthropic key if you set one, but you can also drop a key into Settings; it's stashed in `localStorage` and only ever sent to Anthropic on your behalf. Swap models while you're at it.

## How it fits together

```
┌─────────────┐   ┌─────────────────┐   ┌───────────────┐
│  Storefront │◄─►│  Next.js API    │◄─►│  Neon Postgres │
│  /shop/*    │   │  /api/shop/*    │   │  products,     │
│  SSE stream │   │  /api/chat      │   │  orders,       │
└─────────────┘   │  /api/automations│  │  carts, etc.   │
                  └─────────┬───────┘   └────────┬───────┘
                            │                    │
                    ┌───────▼──────┐    ┌────────▼────────┐
                    │ Orchestrator │    │ Automation run  │
                    │ + 4 agents   │───►│ history         │
                    └──────────────┘    └─────────────────┘
```

All the agent tools query the same Postgres the storefront writes to, so the advice is grounded in the store's actual state — not a vibes-based summary.

## Stack

Next.js 16 (App Router), TypeScript, Vercel AI SDK v6, Claude (Sonnet 4 by default), Drizzle ORM on Neon serverless Postgres, Tailwind v4, a little Recharts, a little Framer Motion.

## Run it

```bash
pnpm install
cp .env.example .env.local   # DATABASE_URL and (optional) ANTHROPIC_API_KEY
pnpm db:push                 # or: pnpm tsx scripts/migrate-new-tables.ts
pnpm db:seed                 # 48 products, 200 customers, 1.2k orders, 15k events
pnpm dev
```

Then:

- [/](http://localhost:3000) — the pitch
- [/shop](http://localhost:3000/shop) — the demo shop (add things to the cart, check out)
- [/dashboard](http://localhost:3000/dashboard) — the merchant desk
- [/chat](http://localhost:3000/chat) — talk to the agents
- [/dashboard/automations](http://localhost:3000/dashboard/automations) — schedule and watch them work
- [/dashboard/settings](http://localhost:3000/dashboard/settings) — drop in your own Anthropic key

## A few honest notes

- Checkout does not take real payment. It writes an order and decrements stock; that's the demo.
- Seed data is deterministic, so `pnpm db:seed` on a fresh DB gives you something recognizable.
- The "realtime" shop is poll-based SSE (every few seconds). A production build would put Postgres LISTEN/NOTIFY or a broker in front of it.
- Access-code gating on `/chat` is there so a public deploy doesn't burn through the owner's API credits; set `ACCESS_CODE` in env to turn it on. Users who bring their own key bypass it.

## License

MIT.
