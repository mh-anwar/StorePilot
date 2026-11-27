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
- App Store review request via App Bridge after the first won dispute (`useReviewRequest` in Inbox.tsx,
  `Shop.reviewRequestedAt`, migration `20261126192000_review_request`).
- Demo fixture dispute 876 (#1019) is now an expired, unanswered loss, so the demo shows the hook.
- Hydration failures on /demo and /privacy fixed (quotes in inline `<style>`); guarded by
  `test/unit/inline-styles.test.ts`. Was present on `main` too.
- `docs/GROWTH_PLAN.md` with changelog.
- Upgrade prompt on the dispute page when packs are used up (`outOfPacks` in detailLoader, `code: "plan_limit"` on ActionResult, Flash offers See plans).
- Public guides `/guides`, `/guides/<slug>` (`app/lib/guides.ts`), `/sitemap.xml`, `/robots.txt`.
- Monthly summary email (`app/lib/alerts/summary.server.ts`, `Shop.monthlySummary`/`summaryMonth`, migration `20261126193000_monthly_summary`), run by the same hourly scheduler and `/cron/deadlines`.

## In progress
- (none)

## Up next (not started)


- Regenerate listing screenshots at 1600x900 including the setup guide and alerts settings
  (`pnpm walkthrough`; README screenshots predate the setup guide).


## Checks
`pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e`
