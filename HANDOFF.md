# Handoff: growth pass (branch `growth/2026-11-26`, draft PR #5)

Live work queue. Update after every step so the next agent can pick up.

## Done
- First-run setup guide on the home page (`app/components/SetupGuide.tsx`, `app/lib/onboarding.ts`),
  dismissible per shop (`Shop.setupDismissedAt`, migration `20261126190000_setup_guide`).
- "Lost without a response" stat + banner on the home page (`dashboardStats.unanswered*`).
- Empty state for shops with no disputes, with a link to the demo.
- Deadline alert emails for Growth/Pro (`app/lib/alerts/*`, `app/routes/cron.deadlines.tsx`,
  migration `20261126191000_deadline_alerts`, Settings section). Resend via env vars; docs in INSTALL.md.
- Public landing page rewritten (problem, steps, pricing, FAQ, install form, meta/OG tags).
- App Store listing copy in `docs/APP_STORE_LISTING.md`, limits checked by `test/unit/listing.test.ts`.

## In progress
- `docs/GROWTH_PLAN.md` + changelog.

## Up next (not started)
- Add an "expired unanswered" dispute to the demo fixtures so the demo shows the
  lost-without-a-response banner (update counts in `test/integration/*` that assume 10 disputes).
- React hydration warnings (#418/#425) on `/demo` pages in production build; seen in headless Chrome.
  Probably Polaris web components touching the DOM before hydration. Not checked against `main`.
- Regenerate listing screenshots at 1600x900 including the setup guide and alerts settings.
- In-app review prompt after a dispute is won (ask for an App Store review at the happiest moment).

## Checks
`pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e`
