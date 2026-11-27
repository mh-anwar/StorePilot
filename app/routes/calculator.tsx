import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useState } from "react";
import { calculate, CALCULATOR_DEFAULTS, type CalculatorInput } from "../lib/calculator";
import { publicOrigin, socialImage } from "../lib/seo";
import styles from "./_index/styles.module.css";

const TITLE = "Chargeback service fee calculator: keep 100% vs pay 25% | StorePilot";
const DESCRIPTION =
  "See what percentage-fee chargeback services cost your Shopify store in a year, compared with a flat monthly price where you keep everything you win.";

export const loader = ({ request }: LoaderFunctionArgs) => ({ origin: publicOrigin(request) });

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  ...socialImage(data?.origin),
];

const dollars = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const FIELDS: Array<{ key: keyof CalculatorInput; label: string; hint: string; step: number; max: number }> = [
  { key: "disputesPerMonth", label: "Disputes a month", hint: "Check Shopify Payments > Disputes for the last few months.", step: 1, max: 10000 },
  { key: "averageAmount", label: "Average disputed amount ($)", hint: "Roughly your average order value.", step: 5, max: 1000000 },
  { key: "winRate", label: "Share of disputes won (%)", hint: "Many stores win 30-60% of the disputes they answer.", step: 5, max: 100 },
  { key: "feePercent", label: "Service fee (% of recoveries)", hint: "Contingency services usually keep 20-25%.", step: 1, max: 100 },
];

export default function Calculator() {
  const [input, setInput] = useState<CalculatorInput>(CALCULATOR_DEFAULTS);
  const r = calculate(input);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Chargeback fee calculator</p>
        <h1 className={styles.name}>Keep 100% of what you win, or pay a quarter of it?</h1>
        <p className={styles.pitch}>
          Percentage-fee chargeback services take a cut of every dispute they win for you. Put in your numbers to see
          what that adds up to in a year.
        </p>
      </section>

      <section className={styles.band} aria-labelledby="inputs">
        <h2 id="inputs" className={styles.h2}>
          Your store
        </h2>
        <div className={styles.grid4}>
          {FIELDS.map((f) => (
            <label key={f.key} className={styles.card}>
              <h3>{f.label}</h3>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                max={f.max}
                step={f.step}
                value={String(input[f.key])}
                onChange={(e) => {
                  const value = Number(e.currentTarget.value);
                  setInput((prev) => ({ ...prev, [f.key]: Number.isFinite(value) ? value : 0 }));
                }}
              />
              <p>{f.hint}</p>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="result" aria-live="polite">
        <h2 id="result" className={styles.h2}>
          A year of chargebacks
        </h2>
        <div className={styles.grid3}>
          <div className={styles.card}>
            <h3>Recovered</h3>
            <p className={styles.price}>{dollars(r.recoveredPerYear)}</p>
            <p>Money back from disputes you win.</p>
          </div>
          <div className={styles.card}>
            <h3>{`A ${input.feePercent}% service keeps`}</h3>
            <p className={styles.price}>{dollars(r.serviceFeePerYear)}</p>
            <p>Charged on every win, every year.</p>
          </div>
          <div className={styles.card}>
            <h3>{`StorePilot ${r.plan.label}`}</h3>
            <p className={styles.price}>{dollars(r.planCostPerYear)}</p>
            <p>{r.plan.priceUsd ? `$${r.plan.priceUsd} a month, flat. You keep the rest.` : "Free for up to 3 disputes a month."}</p>
          </div>
        </div>
        <p className={styles.pitch} style={{ marginTop: 32, textAlign: "center" }}>
          {r.savingsPerYear > 0
            ? `You'd keep ${dollars(r.savingsPerYear)} more a year with StorePilot.`
            : "At this volume a percentage fee and StorePilot cost about the same; the difference is that StorePilot shows you every response before it's sent."}
        </p>
        <div className={styles.ctas}>
          <a className={styles.primary} href="/demo">
            Try the live demo
          </a>
          <a className={styles.secondary} href="/#install">
            Install on my store
          </a>
        </div>
        <p className={styles.small}>
          Estimates only. Win rates depend on the dispute reason and the evidence you have. StorePilot doesn&apos;t
          guarantee outcomes.
        </p>
      </section>

      <nav className={styles.nav} aria-label="Footer">
        <a className={styles.link} href="/">
          StorePilot
        </a>
        <a className={styles.link} href="/guides">
          Chargeback guides
        </a>
        <a className={styles.link} href="/privacy">
          Privacy
        </a>
      </nav>
    </main>
  );
}
