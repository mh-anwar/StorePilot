# Installing StorePilot on your store

About 15 minutes, no command line needed. You'll do three things: create the app
in Shopify's Dev Dashboard, deploy this repo to Render, and click Install.

**You need**

- A Shopify Dev Dashboard account (free, at [dev.shopify.com](https://dev.shopify.com/dashboard/)).
- A store that takes payments through Shopify Payments, or a development store
  (disputes only exist on Shopify Payments).
- A [Render](https://render.com) account. The Starter instance plus a 1 GB disk is about $7.25/month.
- Optional: an [Anthropic API key](https://console.anthropic.com/) for Claude-written
  rebuttals. Without one, StorePilot writes drafts from its built-in templates.

---

## 1. Create the app and copy its keys

1. Open the [Dev Dashboard](https://dev.shopify.com/dashboard/) → **Apps** → **Create app**.
2. Choose **Start from Dev Dashboard**, name it `StorePilot`, and select **Create**.
3. Open the app's **Settings** and keep the tab open. You need the **Client ID** and
   **Client secret** in the next step.

## 2. Deploy the server

Click **[Deploy to Render](https://render.com/deploy?repo=https://github.com/mh-anwar/StorePilot)**.
Render reads `render.yaml` and asks for three values:

| Render asks for | Paste |
|---|---|
| `SHOPIFY_API_KEY` | the **Client ID** |
| `SHOPIFY_API_SECRET` | the **Client secret** |
| `ANTHROPIC_API_KEY` | your Anthropic key, or leave it empty |

Click **Apply**. The first build takes 3-5 minutes. When it's live, Render shows the
service URL, something like `https://storepilot-ab12.onrender.com`. Open
`<that URL>/healthz`: it should say `{"ok":true}`. You don't have to tell the app its
own URL; it reads it from Render (`RENDER_EXTERNAL_URL`).

You can also open `<that URL>/demo` now to try the whole product on a fake store.

## 3. Point the app at your server

Back in the Dev Dashboard, open the app → **Versions** → **Create version** and fill in:

| Field | Value |
|---|---|
| App URL | `https://<your-render-url>` |
| Embed app in Shopify admin | On |
| Webhooks API version | `2026-10` |
| Scopes | `read_orders,read_customers,read_legal_policies,read_shopify_payments_disputes,read_shopify_payments_dispute_evidences,write_shopify_payments_dispute_evidences` |
| Redirect URLs (if shown) | `https://<your-render-url>/auth/callback` |
| Compliance webhooks (if shown) | `https://<your-render-url>/webhooks/compliance` for all three |

Select **Release**.

## 4. Install

On the app's overview page, select **Install app** in the **Installs** card, pick your
store, and select **Install**. Shopify opens StorePilot inside your admin.

On that first load StorePilot:

1. exchanges the session token for an offline access token (stored in SQLite on the Render disk),
2. registers its webhooks: `disputes/create`, `disputes/update`, `app/uninstalled`,
   `app_subscriptions/update`,
3. reads your store name and published refund/shipping policies,
4. imports every Shopify Payments dispute on the store.

That's it. New disputes appear in the inbox as Shopify opens them.

---

## Things Shopify asks of apps that read customer data

**Protected customer data.** Evidence packs include the customer's name, email and
shipping address, which Shopify treats as protected customer data. On development
stores this works straight away. Before installing on a live store, go to the app's
**API access** page in the Dev Dashboard, request access to protected customer data
(name, email, address) and give the reason "Building dispute evidence for the
merchant's own chargebacks". StorePilot only stores this inside the dispute's
evidence pack and erases it on `customers/redact` (see the privacy policy at
`/privacy` on your server).

**Orders older than 60 days.** Disputes can arrive up to 120 days after a sale, but
`read_orders` only returns the last 60 days of orders. If a pack fails with "Shopify
didn't return order …", request the `read_all_orders` scope on the API access page,
then add it to the version's scopes and to the `SCOPES` environment variable on Render.

**Compliance webhooks.** If the version form doesn't show compliance webhook fields,
StorePilot still works on your own store. They're required to list on the App Store;
the Shopify CLI route below sets them from `shopify.app.toml`.

## Billing

Plans are charged through the Shopify Billing API (Free, Growth $29, Pro $79, 7-day
trial). `BILLING_TEST_MODE` is `true` by default, so approving a plan creates a test
charge and nobody is billed. Set it to `false` only when the app is publicly
distributed; Shopify doesn't allow Billing API charges from custom-distribution apps.

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `SHOPIFY_API_KEY` | yes | Client ID |
| `SHOPIFY_API_SECRET` | yes | Client secret; also verifies webhook signatures |
| `SHOPIFY_APP_URL` | no on Render/Fly | Public URL. Detected from `RENDER_EXTERNAL_URL` or `FLY_APP_NAME` |
| `DATABASE_URL` | yes | `file:/data/storepilot.sqlite` (the persistent disk) |
| `SCOPES` | no | Defaults to the six scopes above |
| `ANTHROPIC_API_KEY` | no | Turns on Claude drafts for Growth (Haiku) and Pro (Sonnet) |
| `STOREPILOT_MODEL` | no | Force one Claude model for every draft |
| `BILLING_TEST_MODE` | no | `true` (default) creates test charges |
| `REGISTER_WEBHOOKS` | no | `off` skips API webhook registration (if you deploy `shopify.app.toml` instead) |
| `DEMO_MODE` | no | `off` disables `/demo` |
| `DEMO_AI` | no | `on` lets the public demo use your Anthropic key (off by default) |
| `PRIVACY_CONTACT_EMAIL` | no | Shown on `/privacy` |
| `RESEND_API_KEY` | no | Sends deadline alert emails (Growth and Pro) through [Resend](https://resend.com). Without it alerts are skipped |
| `ALERTS_FROM_EMAIL` | with Resend | Sender address on a domain verified in Resend, e.g. `StorePilot <alerts@yourdomain.com>` |
| `DEADLINE_ALERTS` | no | `off` stops the built-in hourly alert run |
| `CRON_SECRET` | no | Enables `GET/POST /cron/deadlines` (with `Authorization: Bearer <secret>`) to trigger an alert run from an outside scheduler |

### Deadline alerts

Growth and Pro shops get an email when a dispute arrives and again when it has
7, 3 and 1 day left, one digest per shop per run. The server runs this every hour
by itself; each dispute is emailed at most once per stage, so extra runs through
`/cron/deadlines` are harmless. Accepted, submitted and expired disputes are left
out. Merchants can turn alerts off or change the address in Settings. Emails go to
the store's email unless they set another one.

## Other ways to run it

**Fly.io.** `fly launch --copy-config --no-deploy`, then
`fly volumes create storepilot_data --size 1`,
`fly secrets set SHOPIFY_API_KEY=… SHOPIFY_API_SECRET=…` and `fly deploy`.
The app URL is `https://<app-name>.fly.dev`. Keep exactly one machine: SQLite lives on its volume.

**Any Docker host.** `docker build -t storepilot .` and run it with the variables above,
a volume at `/data`, port 3000, and HTTPS in front of it.

**Shopify CLI (for App Store submission or local development).**

```bash
pnpm install
pnpm shopify app config link   # pick or create the app; fills client_id in shopify.app.toml
pnpm shopify app deploy        # pushes scopes, app URL, webhooks and compliance webhooks
pnpm dev                       # local dev through a Cloudflare tunnel, with hot reload
```

When `shopify.app.toml` is deployed this way you can set `REGISTER_WEBHOOKS=off`;
leaving it on is harmless (the handlers are idempotent).

## Troubleshooting

- **Blank page or "Detected an empty appUrl" in the logs.** `SHOPIFY_API_KEY`,
  `SHOPIFY_API_SECRET` or the app URL isn't set. `/healthz` and `/demo` still work.
- **"Invalid session token" loop in the admin.** The Client ID on the server doesn't
  match the app you installed, or the version's App URL points at a different server.
- **No disputes show up.** Disputes only exist for Shopify Payments. Use
  **Sync from Shopify** on the inbox to re-import, and check the Render logs for
  `[install]` lines.
- **Webhooks return 401.** The server's `SHOPIFY_API_SECRET` isn't this app's secret.
