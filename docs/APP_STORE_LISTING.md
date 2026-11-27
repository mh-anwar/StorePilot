# Shopify App Store listing

Copy for the StorePilot listing in the Partner Dashboard, kept in the repo so it
changes with the product. Character counts are checked by
`test/unit/listing.test.ts` against the limits Shopify's listing form enforced
when this was written; re-check them in the form before submitting, since
Shopify adjusts the limits from time to time.

Rules this copy follows (from Shopify's listing requirements):
no pricing in the name, subtitle or introduction; no claims we can't back up
("guaranteed", "#1"); no other brands in the name; no superlatives without
proof; features describe what the app does, not what it is.

## App name

<!-- listing:name max=30 -->
StorePilot Chargeback Defense
<!-- /listing -->

## App card subtitle

<!-- listing:subtitle max=62 -->
Answer Shopify Payments chargebacks with evidence, fast
<!-- /listing -->

## App introduction

<!-- listing:introduction max=100 -->
Evidence packs and drafted responses for every dispute. You review and submit. No cut of recoveries.
<!-- /listing -->

## App details

<!-- listing:details max=500 -->
Most small stores lose chargebacks because nobody answers in time. The evidence sits on five admin pages and the deadline is short. StorePilot gathers it for you the moment a dispute opens: payment checks, tracking and delivery, refunds, the customer's past orders and your policies. It tells you whether the dispute is worth fighting and drafts a response written for that reason code. You edit anything and press submit. Flat monthly price, so you keep what you win.
<!-- /listing -->

## Feature list

<!-- listing:features max=80 each -->
- Evidence pack built from your Shopify data the moment a dispute opens
- Fight-or-accept recommendation with the reasons spelled out
- Response drafted for the dispute's reason code, plus every bank field
- Nothing goes to the bank until you review it and press submit
- Deadline alerts by email, and a dashboard of money recovered
<!-- /listing -->

## Search terms

<!-- listing:search max=20 each, 5 terms -->
- chargeback
- dispute
- chargeback response
- fraud
- shopify payments
<!-- /listing -->

## Categories

- Primary: Store management > Fraud
- Secondary: Finances > Payments (if offered in the form; otherwise Store management > Operations)

## Pricing (as entered in the listing's pricing section)

| Plan | Price | Bullets |
|---|---|---|
| Free | Free | 3 evidence packs a month · Fight-or-accept recommendation · Template drafts |
| Growth | $29/month, 7-day trial | 30 evidence packs a month · AI-written responses · Email alerts before deadlines |
| Pro | $79/month, 7-day trial | Unlimited evidence packs · Stronger AI responses · Drafted the moment a dispute arrives · Email alerts |

Keep these in step with `app/lib/billing/plans.ts`.

## Screenshots (1600 x 900, in this order)

1. Dispute inbox with the deadline banner and the stat row (`docs/screenshots/inbox.png`).
   Caption: "Every dispute, sorted by deadline, with what's at stake."
2. Dispute detail with the evidence checklist and recommendation (`dispute.png`).
   Caption: "The evidence the bank looks for, already gathered."
3. An "accept" recommendation on a small, weak claim (`accept-recommendation.png`).
   Caption: "Straight advice, including when not to fight."
4. The submit confirmation (`submit-confirm.png`).
   Caption: "You approve every response before it's sent."
5. Settings with deadline alerts (`settings.png`).
   Caption: "Alerts before deadlines so nothing expires unanswered."

The README screenshots are 2720 x 1800; export the listing set at 1600 x 900 from
the demo (`pnpm walkthrough`) with the browser window at 1600 x 900.

## Demo store URL

`https://<your-app-host>/demo`: the full flow on a seeded store, no install needed.

## Support and privacy

- Privacy policy URL: `https://<your-app-host>/privacy`
- Support email: set in the Partner Dashboard; answer within one business day
  (response time is shown on the listing and affects ranking).
- FAQ for the listing: reuse the questions on the landing page (`app/routes/_index/route.tsx`).

## Review checklist before submitting

- [ ] Install from the listing on a fresh development store: the setup guide shows,
      disputes import, Settings opens. No full-page redirects outside the admin.
- [ ] Billing: subscribing to Growth and Pro from Plans works in test mode, and
      cancelling drops back to Free.
- [ ] Uninstall and reinstall: data is cleared on `shop/redact`, the app works again.
- [ ] All three privacy webhooks answer 200 with a valid HMAC and 401 without.
- [ ] Screenshots show the embedded app, not the demo bar.
- [ ] `BILLING_TEST_MODE=false` on the production server.
