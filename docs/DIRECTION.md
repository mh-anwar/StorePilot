# Direction: chargeback defense for Shopify Payments merchants

_Decided July 2026. This replaces the "LLM workflow engine" pitch in the old README._

## The decision

StorePilot is now one thing: **it answers Shopify Payments chargebacks for you.**
When a dispute lands, StorePilot pulls the order, payment checks, fulfillment and
tracking, customer history and your store policies into an evidence pack, drafts a
reason-code-specific rebuttal, and puts it in front of you with a clear
recommendation: fight or accept. You read it, edit anything you want, and click
submit. Nothing goes to the bank without a human pressing the button.

Everything else the old codebase did (a generic workflow builder, a demo
storefront, a chat agent, analytics pages) is retired.

## Why not the workflow engine

The workflow engine was a platform looking for a problem.

- **Nobody buys "a workflow engine".** Merchants buy outcomes. "Build your own LLM
  workflow" asks a store owner to be a product designer. Shopify Flow is free,
  bundled, and already owns the "automation" mental model; Sidekick owns "ask the AI".
  Competing with both on breadth is a losing position for a small app.
- **The value was in the templates, not the engine.** Every compelling example in the
  old README (fraud triage, restock plans, review replies) was a specific job. The
  engine only mattered as plumbing for those jobs.
- **Approval gates are the real insight.** Merchants will let an AI draft but not act.
  That idea survives the pivot intact: StorePilot drafts, the merchant approves.

## Why chargebacks, out of the candidates

We compared the three jobs the old README kept coming back to:

| | Chargeback responses | Restock planning | Review replies + refunds |
|---|---|---|---|
| Pain | Money is already gone; a deadline is ticking; every lost dispute also costs a fee | Real, but slow-burning; merchants muddle through with spreadsheets | Low; mostly time and tone |
| Frequency for a small store | A few a month, each one painful | Weekly | Daily but tiny |
| How it's handled today | Ignored (auto-lose) or 30-60 min of copy-paste per dispute | Spreadsheets, or $250+/mo planning tools | Manually, or not at all |
| Is an LLM the right tool? | Yes: the hard part is writing a persuasive, reason-specific narrative from scattered facts | Mostly no: forecasting is arithmetic | Yes, but low stakes |
| ROI you can show on one screen | "$X recovered this month" | "stockouts avoided" (counterfactual, hard to prove) | "replies sent" |
| Fits "AI drafts, human approves" | Perfectly: the bank only gets one submission, so review matters | Okay | Okay |
| Shopify API support | First-class: `disputes`, `dispute`, `disputeEvidenceUpdate`, `disputes/*` webhooks | Good | Reviews are not in the Admin API (third-party apps own them) |

Chargebacks win on every row that matters for a paid app: acute pain, a deadline
that forces action, a dollar number we can put on the dashboard, and an API that
lets us do the whole job inside Shopify.

Fraud *prevention* (scoring orders before they ship) was also considered and
rejected as the wedge: Shopify already shows fraud analysis on every order, and
the established players sell chargeback guarantees we can't underwrite. Answering
disputes after the fact is where merchants are left on their own.

## Who it's for

Shopify Payments merchants doing roughly $20k-$2M a year who get a handful of
disputes a month and don't have anyone whose job is chargebacks. Big merchants
already pay Chargeflow-style services 20-25% of what they recover; small ones
mostly let disputes expire. A flat monthly price is the differentiator: you keep
100% of what you win.

## The product loop

1. **Ingest.** `disputes/create` and `disputes/update` webhooks, plus a full sync
   on install and on demand, keep a local copy of every dispute.
2. **Assemble.** For each dispute, pull the order, transactions (AVS/CVV results),
   fulfillments and tracking, customer order history and store policies into an
   evidence pack, and score how strong it is for that reason code.
3. **Recommend.** Fight or accept, with the reasons spelled out. Weak evidence on a
   small amount is often not worth fighting; we say so.
4. **Draft.** A rebuttal letter plus the reason-specific evidence fields
   (shipping documentation for "not received", refund-refusal explanation for
   "not as described", access/AVS for "fraudulent", and so on). Claude writes it
   when an API key is configured; a deterministic template writer covers the same
   fields without one.
5. **Approve.** The merchant edits and either saves the draft to Shopify or
   submits it to the bank. Submission is explicit, logged, and irreversible, so
   the UI says that.
6. **Track.** Deadline countdowns, outcome sync (won/lost), and a dashboard with
   win rate and money recovered.

## Pricing (Shopify Billing API)

| Plan | Price | What you get |
|---|---|---|
| Free | $0 | 3 evidence packs a month, template drafts |
| Growth | $29/mo | 30 packs a month, AI drafts, deadline alerts |
| Pro | $79/mo | Unlimited packs, AI drafts, auto-draft on arrival |

All paid plans have a 7-day trial. No percentage of recoveries, ever.

## What we deliberately don't do

- No auto-submit. The merchant presses the button every time.
- No fraud scoring of new orders, no PayPal/Stripe disputes (Shopify Payments only).
- No data we don't need: minimal scopes, customer details are only kept inside an
  evidence pack and are scrubbed on `customers/redact`.

## Technical shape

Shopify's React Router app template (Shopify CLI, `shopify.app.toml`, App Bridge,
Polaris web components, Prisma session storage), GraphQL Admin API only,
app-specific webhooks declared in the TOML, Billing API for plans, Docker image
deployable to Fly.io or Render. A `/demo` route runs the full loop against seeded
data and a mocked Admin API so the product can be shown without a store.
