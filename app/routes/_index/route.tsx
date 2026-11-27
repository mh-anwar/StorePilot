import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";

import { PLANS } from "../../lib/billing/plans";
import { appUrl, login } from "../../shopify.server";
import styles from "./styles.module.css";

const TITLE = "StorePilot: win Shopify Payments chargebacks without the 25% fee";
const DESCRIPTION =
  "StorePilot builds the evidence pack for every Shopify Payments dispute, recommends fight or accept, and drafts the response for you to review. Flat monthly price, free plan, nothing sent without your OK.";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:image", content: `${data?.origin ?? ""}/og.png` },
  { name: "twitter:card", content: "summary_large_image" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login), origin: (appUrl || url.origin).replace(/\/$/, "") };
};

const STEPS = [
  {
    title: "A dispute arrives",
    body: "StorePilot picks it up from Shopify within seconds and puts the deadline at the top of your inbox. Paid plans email you too.",
  },
  {
    title: "The evidence is gathered for you",
    body: "Order, AVS and CVV checks, tracking and delivery, refunds, the customer's past orders and your policies, in one pack.",
  },
  {
    title: "You get a straight answer",
    body: "Fight, accept, or your call, with the reasons listed. A $12 fraud claim with no delivery proof isn't worth your afternoon.",
  },
  {
    title: "You review and submit",
    body: "A rebuttal written for that reason code, plus every field the bank asks for. Edit anything. Nothing goes out until you press submit.",
  },
];

const FAQ = [
  {
    q: "Do you take a cut of what I win?",
    a: "No. You pay a flat monthly price, or nothing on the Free plan. Every dollar you recover stays with you.",
  },
  {
    q: "Will it submit anything without me?",
    a: "Never. The bank only accepts one response per dispute, so StorePilot always waits for you to review and press submit.",
  },
  {
    q: "Which disputes does it handle?",
    a: "Chargebacks and inquiries on Shopify Payments, for every reason code: fraudulent, not received, not as described, duplicate, subscription canceled, credit not processed and the rest.",
  },
  {
    q: "What data does it read?",
    a: "Only what a response needs: orders, the customers on disputed orders, your legal policies and the disputes themselves. Customer data is erased when Shopify asks, and everything is deleted when you uninstall.",
  },
  {
    q: "Can I see it before installing?",
    a: "Yes. The demo runs the real app against a sample store with ten disputes. Draft, edit, submit and let the bank decide.",
  },
];

/** schema.org FAQPage for search rich results. "<" is escaped so the JSON can't close the script tag. */
export function faqJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }).replace(/</g, "\\u003c");
}

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();
  const plans = [PLANS.free, PLANS.growth, PLANS.pro];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>For stores on Shopify Payments</p>
        <h1 className={styles.name}>Stop losing chargebacks you never answered.</h1>
        <p className={styles.pitch}>
          StorePilot builds the evidence pack for every dispute, tells you whether it&apos;s worth fighting, and drafts
          the response. You review it and press submit. No 25% cut of what you win.
        </p>
        <div className={styles.ctas}>
          <a className={styles.primary} href="/demo">
            Try the live demo
          </a>
          <a className={styles.secondary} href="#install">
            Install on my store
          </a>
        </div>
        <p className={styles.small}>Free plan included. Paid plans have a 7-day trial, billed through Shopify.</p>
      </section>

      <section className={styles.band} aria-labelledby="why">
        <h2 id="why" className={styles.h2}>
          Why most small stores lose disputes
        </h2>
        <div className={styles.grid3}>
          <div className={styles.card}>
            <h3>The deadline slips by</h3>
            <p>Unanswered disputes close as lost, and you still pay the chargeback fee.</p>
          </div>
          <div className={styles.card}>
            <h3>The evidence is everywhere</h3>
            <p>Payment checks, tracking, refunds and policies sit on different admin pages. Collecting them takes an hour.</p>
          </div>
          <div className={styles.card}>
            <h3>Services take a quarter</h3>
            <p>
              Done-for-you chargeback services keep 20-25% of what they recover. StorePilot is a flat price.{" "}
              <a className={styles.link} href="/calculator">
                See the difference for your store
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className={styles.h2}>
          How it works
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.title} className={styles.step}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <img
          className={styles.shot}
          src="/screenshots/dispute.png"
          alt="A dispute in StorePilot: evidence checklist, recommendation and drafted response"
          loading="lazy"
        />
      </section>

      <section className={styles.band} aria-labelledby="pricing">
        <h2 id="pricing" className={styles.h2}>
          Pricing
        </h2>
        <div className={styles.grid3}>
          {plans.map((p) => (
            <div key={p.key} className={styles.card}>
              <h3>{p.label}</h3>
              <p className={styles.price}>{p.priceUsd === 0 ? "$0" : `$${p.priceUsd}/month`}</p>
              <ul className={styles.features}>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq">
        <h2 id="faq" className={styles.h2}>
          Questions
        </h2>
        <div className={styles.faq}>
          {FAQ.map((f) => (
            <details key={f.q} className={styles.qa}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />

      <section id="install" className={styles.band} aria-labelledby="install-h">
        <h2 id="install-h" className={styles.h2}>
          Install StorePilot
        </h2>
        {showForm ? (
          <Form method="post" action="/auth/login" className={styles.form}>
            <label htmlFor="shop" className={styles.label}>
              Your store&apos;s Shopify domain
            </label>
            <input
              type="text"
              name="shop"
              id="shop"
              placeholder="my-store.myshopify.com"
              autoComplete="url"
              className={styles.input}
            />
            <button type="submit" className={styles.button}>
              Install or log in
            </button>
          </Form>
        ) : (
          <p className={styles.small}>Installs are not open on this server yet. The demo works without a store.</p>
        )}
      </section>

      <nav className={styles.nav} aria-label="Footer">
        <a className={styles.link} href="/demo">
          Demo
        </a>
        <a className={styles.link} href="/guides">
          Chargeback guides
        </a>
        <a className={styles.link} href="/calculator">
          Fee calculator
        </a>
        <a className={styles.link} href="/privacy">
          Privacy
        </a>
      </nav>
    </main>
  );
}
