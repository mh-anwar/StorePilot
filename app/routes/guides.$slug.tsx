import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { guideBySlug, guideJsonLd, GUIDES } from "../lib/guides";
import { publicOrigin, socialImage } from "../lib/seo";
import styles from "./_index/styles.module.css";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const guide = guideBySlug(params.slug);
  if (!guide) throw new Response("Not found", { status: 404 });
  const origin = publicOrigin(request);
  return {
    origin,
    guide,
    jsonLd: guideJsonLd(guide, `${origin}/guides/${guide.slug}`),
    others: GUIDES.filter((g) => g.slug !== guide.slug).map((g) => ({ slug: g.slug, title: g.title })),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  data
    ? [
        { title: `${data.guide.title.replace(/[“”]/g, '"')} | StorePilot` },
        { name: "description", content: data.guide.description },
        { property: "og:title", content: data.guide.title },
        { property: "og:description", content: data.guide.description },
        { property: "og:type", content: "article" },
        ...socialImage(data.origin),
      ]
    : [{ title: "Guide not found | StorePilot" }];

export default function GuidePage() {
  const { guide, others, jsonLd } = useLoaderData<typeof loader>();
  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <article className={styles.section}>
        <p className={styles.eyebrow}>
          <a className={styles.link} href="/guides">
            Chargeback guides
          </a>
        </p>
        <h1 className={styles.name} style={{ textAlign: "left", marginLeft: 0 }}>
          {guide.title}
        </h1>
        <p className={styles.pitch} style={{ marginLeft: 0 }}>
          {guide.claim}
        </p>

        <h2 className={styles.h2} style={{ textAlign: "left" }}>
          Evidence that wins, most important first
        </h2>
        <ol className={styles.features}>
          {guide.evidence.map((e) => (
            <li key={e.item}>
              <strong>{e.item}.</strong> {e.why}
            </li>
          ))}
        </ol>

        <h2 className={styles.h2} style={{ textAlign: "left", marginTop: 40 }}>
          When to accept instead
        </h2>
        <p className={styles.pitch} style={{ marginLeft: 0 }}>
          {guide.accept}
        </p>

        <h2 className={styles.h2} style={{ textAlign: "left", marginTop: 40 }}>
          Common mistakes
        </h2>
        <ul className={styles.features}>
          {guide.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <div className={styles.card} style={{ marginTop: 40 }}>
          <h3>Let StorePilot put this together for you</h3>
          <p>
            StorePilot reads the order, payment checks, tracking, refunds and your policies from Shopify, scores them
            against this checklist, tells you whether to fight, and drafts the response. You review it and press submit.
          </p>
          <div className={styles.ctas} style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <a className={styles.primary} href="/demo">
              Try the live demo
            </a>
            <a className={styles.secondary} href="/#install">
              Install on my store
            </a>
          </div>
        </div>

        <h2 className={styles.h2} style={{ textAlign: "left", marginTop: 48 }}>
          Other dispute reasons
        </h2>
        <ul className={styles.features}>
          {others.map((o) => (
            <li key={o.slug}>
              <a className={styles.link} href={`/guides/${o.slug}`}>
                {o.title}
              </a>
            </li>
          ))}
        </ul>
      </article>
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
