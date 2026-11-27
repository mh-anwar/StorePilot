import type { MetaFunction } from "react-router";
import { GUIDES } from "../lib/guides";
import styles from "./_index/styles.module.css";

const TITLE = "Shopify chargeback guides: what evidence wins each dispute | StorePilot";
const DESCRIPTION =
  "Plain guides to answering Shopify Payments chargebacks by reason: not received, fraudulent, not as described, credit not processed, subscriptions and duplicates.";

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
];

export default function Guides() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Chargeback guides</p>
        <h1 className={styles.name}>Got a chargeback on Shopify? Start here.</h1>
        <p className={styles.pitch}>
          Every dispute has a reason, and each reason needs different evidence. Pick the one in your dispute email.
          The deadline is usually 7 to 21 days, and a dispute with no response is closed as lost.
        </p>
      </section>
      <section className={styles.band}>
        <div className={styles.grid3}>
          {GUIDES.map((g) => (
            <a key={g.slug} href={`/guides/${g.slug}`} className={styles.card} style={{ textDecoration: "none", color: "inherit" }}>
              <h3>{g.title.replace(/^How to answer an? /, "").replace(/ chargeback on Shopify$/, "")}</h3>
              <p>{g.description}</p>
            </a>
          ))}
        </div>
      </section>
      <nav className={styles.nav} aria-label="Footer">
        <a className={styles.link} href="/">
          StorePilot
        </a>
        <a className={styles.link} href="/demo">
          Demo
        </a>
        <a className={styles.link} href="/privacy">
          Privacy
        </a>
      </nav>
    </main>
  );
}
