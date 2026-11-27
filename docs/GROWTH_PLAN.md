# Growth plan: getting StorePilot installed

_Written 2026-11-26 alongside the growth pass on branch `growth/2026-11-26`._

The goal is installs that turn into paying merchants. StorePilot has a narrow,
painful job (answering Shopify Payments chargebacks) and an easy pitch against
the incumbents ("keep 100% of what you win"). Most of the work below is getting
that pitch in front of merchants at the moment a dispute lands.

## 1. Who we're after

- Shopify Payments stores doing roughly $20k-$2M a year, a handful of disputes a
  month, nobody whose job is chargebacks.
- Trigger moment: the merchant gets the "You have a new chargeback" email from
  Shopify and searches the App Store or Google for what to do.
- Main alternatives they'll compare: doing nothing (auto-lose), doing it by hand
  in the admin, and percentage-fee services (20-25% of recoveries).

## 2. Shopify App Store (the main channel)

Most installs for a Shopify app come from App Store search. What moves ranking:
keyword match in the name/subtitle/introduction, install velocity, reviews
(count and recency), and support response time.

Done in this pass:
- Listing copy in [`APP_STORE_LISTING.md`](APP_STORE_LISTING.md), checked against
  Shopify's field limits by a unit test so it can't silently go over.
- Name carries the main keyword: "StorePilot Chargeback Defense".
- Review request through App Bridge after the first won dispute (the moment the
  app has visibly paid for itself).

Next:
1. **Submit for review** with the checklist at the bottom of the listing doc. Use
   the demo store URL in the submission so reviewers can see the flow without
   seeding disputes.
2. **Keyword set**: "chargeback", "dispute", "chargeback response", "fraud",
   "shopify payments". Re-check monthly with the App Store search box's
   autocomplete; swap the weakest term for whatever merchants actually type.
3. **Built for Shopify badge**: the app already uses App Bridge, Polaris web
   components, token-exchange auth and GraphQL only. Remaining work is the
   performance bar (LCP/CLS/INP in the admin) and the install count threshold.
   Track it from day one; the badge lifts ranking and click-through.
4. **First 10 reviews**: personally onboard the first stores (see section 4) and
   ask once they've won a dispute. Never offer anything for a review (against
   Shopify's rules).
5. **Screenshots**: re-export at 1600x900 from the embedded app, with captions
   that state outcomes ("Every dispute, sorted by deadline").
6. **Localized listing** later (French, German, Spanish) once English converts;
   the App Store shows localized listings in those markets.

## 3. Search outside the App Store (SEO)

Merchants google "shopify chargeback what to do" before they ever open the App
Store. The landing page (`/`) now has real copy, a meta description and Open
Graph tags. Next:

- Done in this pass: six guides at `/guides` (one per reason group) plus `/sitemap.xml`
  and `/robots.txt`. Next, submit the sitemap in Google Search Console. Original idea:
  one page per reason code: "How to respond to a 'product not received'
  chargeback on Shopify", "...'fraudulent'...", and so on (10 reason codes). The
  checklist logic in `app/lib/disputes/evidence.ts` is the content; each page ends
  with "StorePilot builds this pack for you" and a link to the demo.
- A free tool: "Chargeback deadline calculator" or "What evidence do I need?"
  (pick reason code, get the checklist). Cheap to build from the existing code,
  linkable, and a natural lead-in to the install.
- A comparison page: StorePilot vs percentage-fee services, with a simple
  calculator ("you win $3,000 a year in disputes: they keep $750, we cost $348").

## 4. Merchant communities (first 50 installs)

- Shopify Community forums, "Payments, Shipping & Fulfillment" board: answer
  chargeback threads properly (the answer is the checklist), mention the app only
  where it fits. Same on r/shopify and r/ecommerce.
- Facebook groups for Shopify store owners; short posts with the free checklist,
  not an ad.
- Offer the first 20 stores a hands-on onboarding call: install with them, check
  their policies and support email (the setup guide's steps), and stay in touch
  until their first dispute is answered. These are the first reviews and the
  source of product feedback.

## 5. Partners

- **Shopify Partners / agencies**: agencies get asked "a customer filed a
  chargeback, what now?" Give them a partner page and a referral link; consider
  the Shopify affiliate/referral setup in the Partner Dashboard.
- **Adjacent apps**: fraud-screening apps, shipping/tracking apps and help desks
  see the same merchants right before a dispute. Cross-listing ("works well
  with") and co-written guides are cheap.
- **Shopify Payments support**: not a channel we control, but a clear,
  accurate guide makes it likelier to be linked from community answers.

## 6. Product hooks already in the app

- **Setup guide** on first open so the first dispute gets a strong response.
- **"Lost without a response"**: after the install-time sync, the home page shows
  how much past disputes cost when nobody answered. This is the upgrade argument
  in the merchant's own numbers, and it's in the demo now too.
- **Deadline alert emails** (Growth and Pro): keeps the app useful between visits,
  which is what keeps it installed.
- **Demo without install** (`/demo`), linked from the landing page and the listing.

Ideas for later, in order of expected effect:
1. A weekly or monthly summary email ("2 disputes answered, $410 recovered").
2. An upgrade prompt when a Free store runs out of packs on a dispute worth more
   than the plan price.
3. Win-rate benchmarks by reason code across all stores (anonymized), shown on the
   dispute page: "Stores win 61% of 'not received' disputes with tracking".
4. Shopify Flow trigger "Dispute needs a response" so stores can route it to Slack
   or a help desk.

## 7. Metrics

Track weekly, in this order:

| Metric | Why | Source |
|---|---|---|
| Listing views → installs | Is the listing converting? | Partner Dashboard listing analytics |
| Installs → setup guide completed | Is onboarding working? | `Shop.lastSyncedAt`, `supportEmail`, policies |
| Stores with ≥1 dispute answered within 30 days | Activation | `Activity` kind `submitted` |
| Free → paid conversion, trial → paid | Revenue | Billing webhooks (`app_subscriptions/update`) |
| Uninstalls within 7 days, with reason | Churn signal | `app/uninstalled` + Partner Dashboard reasons |
| Money recovered across all stores | The headline number for marketing | `Dispute` WON amounts |
| Reviews: count, average, last 30 days | Ranking | App Store |

Targets for the first 90 days after the listing goes live: 30% of installs finish
the setup guide, 50% of stores that receive a dispute answer it, 10% of installs
on a paid plan, 10+ reviews averaging 4.5 or higher.

## 8. Changelog of this growth pass (2026-11-26)

- **First-run setup guide** on the home page: import disputes, support email,
  policies, plan. Hides itself when the required steps are done; can be dismissed
  and brought back.
- **"Lost without a response"** stat and banner: money lost to disputes that
  expired unanswered. The demo's lost dispute is now one of those.
- **Empty state** for stores with no disputes yet, with a link to a sample dispute.
- **Deadline alert emails** for Growth and Pro: on arrival and at 7, 3 and 1 days
  left, one digest per store, never twice per stage, retried on failure. Resend
  as the provider; settings switch and address; `/cron/deadlines` for outside
  schedulers. Fixes the Growth plan advertising "deadline alerts" that Free also had.
- **App Store review request** via App Bridge after the first won dispute, at most
  every 90 days.
- **Landing page** rewritten: problem, four-step flow with a screenshot, pricing
  from the plan definitions, FAQ, install form, meta and Open Graph tags.
- **App Store listing copy** in the repo, with a test that keeps it inside the
  field limits and in step with plan prices.
- **Upgrade prompt** on the dispute page when the month's packs are used up, with
  the dispute's amount and a link to Plans; the failed build offers the same link.
- **Chargeback guides** at `/guides` (six reason groups), `/sitemap.xml` and
  `/robots.txt`, linked from the landing page.
- **Fixed** hydration failures on every `/demo` and `/privacy` page load (quotes in
  inline `<style>` blocks), present on `main` too.
