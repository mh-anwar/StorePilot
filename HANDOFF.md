# Handoff: growth pass (branch `growth/2026-11-26`, draft PR #5)

Live work queue. Update after every step so the next agent can pick up.
Stopped 2026-11-26 ~19:48 EST at the hard stop. Everything below is committed and pushed.

## Done
- First-run setup guide on the home page (`app/components/SetupGuide.tsx`, `app/lib/onboarding.ts`),
  dismissible and restorable per shop (`Shop.setupDismissedAt`, migration `20261126190000_setup_guide`).
- "Lost without a response" stat + banner on the home page (`dashboardStats.unanswered*`); `dashboardStats.total`
  drives the empty state ("No disputes yet") with a link to the demo.
- Deadline alert emails for Growth/Pro (`app/lib/alerts/deadlines.server.ts`, `email.server.ts`,
  `app/routes/cron.deadlines.tsx`, migration `20261126191000_deadline_alerts`). Resend via env vars; docs in INSTALL.md.
- Monthly summary email, every plan (`app/lib/alerts/summary.server.ts`, `Shop.monthlySummary`/`summaryMonth`,
  migration `20261126193000_monthly_summary`), same hourly scheduler and `/cron/deadlines`.
- Settings "Emails" section: alert switch (paid), summary switch, recipient address, "email not configured" warning.
- App Store review request via App Bridge after the first won dispute (`useReviewRequest` in Inbox.tsx,
  `Shop.reviewRequestedAt`, migration `20261126192000_review_request`).
- Upgrade prompt on the dispute page when packs are used up (`outOfPacks` in detailLoader,
  `code: "plan_limit"` on ActionResult, Flash offers "See plans").
- Plans page banner with the store's own numbers (`plansRecord` in views.server.ts, `recordLine` in PlansView.tsx).
- Public landing page rewritten (problem, steps, pricing from PLANS, FAQ + FAQPage JSON-LD, install form, meta/OG tags, `/og.png`).
- Public guides `/guides`, `/guides/<slug>` (`app/lib/guides.ts`, Article JSON-LD), `/sitemap.xml`, `/robots.txt`.
- Fee calculator `/calculator` (`app/lib/calculator.ts`), linked from the landing page, in the sitemap and the walkthrough.
- Dispute page links to the matching guide (`guideForReason`), new guide `general-dispute`.
- Settings "Send a test email" (`intent: "test_email"` in settingsAction).
- Social image tags (og:image, twitter:card) on /guides, guide pages and /calculator (`app/lib/seo.ts`).
- App Store listing copy in `docs/APP_STORE_LISTING.md`, limits checked by `test/unit/listing.test.ts`.
- Demo fixture dispute 876 (#1019) is now an expired, unanswered loss, so the demo shows the hook.
- Bug fixes (both also on `main`): quotes in inline `<style>` broke hydration on /demo and /privacy
  (`test/unit/inline-styles.test.ts`); boolean props on `s-*` elements server-rendered as `="false"` and
  read as true by Polaris (`cond || undefined`, `test/unit/web-component-booleans.test.ts`).
- Walkthrough extended (lost stat, settings switches, landing, guide, sitemap, no page errors), row-count
  flake fixed; README/landing screenshots refreshed from a passing run.
- `docs/GROWTH_PLAN.md` with changelog.

## In progress
- (none)

## Up next (not started)
- Verify in a real dev store: review modal, boolean-prop fix inside the admin, alert email links
  (`/admin/apps/<client id>/app/...` redirect), and a real Resend send with a verified domain.
- Listing screenshots at 1600x900 from the embedded app, per docs/APP_STORE_LISTING.md.
- Submit `/sitemap.xml` to Google Search Console; more guides (one per remaining reason code).
- If the app ever runs more than one instance, put a lock around the hourly email run.

## Checks
`pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e`
Browser: `pnpm build && PORT=3457 pnpm start`, then `BASE_URL=http://127.0.0.1:3457 pnpm walkthrough`.
Last run (19:47): typecheck clean; unit 105, integration 57, e2e 12 pass; walkthrough 18/18.
