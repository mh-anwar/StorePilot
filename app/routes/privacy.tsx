import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy · StorePilot" },
];

export const loader = async () => {
  return {
    contact: process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@example.com",
  };
};

export default function Privacy() {
  const { contact } = useLoaderData<typeof loader>();

  return (
    <main>
      <style>{`
        main {
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 24px 96px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.6;
        }
        h1 {
          font-size: 2rem;
          margin: 0 0 8px;
        }
        h2 {
          font-size: 1.25rem;
          margin: 2em 0 0.5em;
        }
        p, li {
          font-size: 1rem;
          color: #303030;
        }
        ul {
          padding-left: 1.25em;
        }
        li {
          margin: 0.35em 0;
        }
        .updated {
          color: #666;
          margin: 0 0 2em;
        }
        a {
          color: #005bd3;
        }
      `}</style>

      <h1>StorePilot Privacy Policy</h1>
      <p className="updated">Last updated: November 3, 2026</p>

      <h2>Who we are</h2>
      <p>
        StorePilot is a Shopify app that helps Shopify Payments merchants answer
        chargebacks and payment disputes. Questions about this policy or your
        data can be sent to{" "}
        <a href={`mailto:${contact}`}>{contact}</a>.
      </p>

      <h2>Data we access via Shopify</h2>
      <p>
        When you install StorePilot, we request only the Shopify API scopes we
        need to do the job:
      </p>
      <ul>
        <li>
          <strong>read_orders</strong> — to pull the disputed order (line items,
          amounts, addresses, fulfillment and tracking) into an evidence pack.
        </li>
        <li>
          <strong>read_customers</strong> — to pull the customer&apos;s order
          history and contact details for the disputed order.
        </li>
        <li>
          <strong>read_legal_policies</strong> — to read your store&apos;s
          refund and shipping policies so we can cite them in a rebuttal.
        </li>
        <li>
          <strong>read_shopify_payments_disputes</strong> — to detect and sync
          disputes so we can prepare a response before the deadline.
        </li>
        <li>
          <strong>read_shopify_payments_dispute_evidences</strong> — to read the
          current evidence Shopify holds for a dispute.
        </li>
        <li>
          <strong>write_shopify_payments_dispute_evidences</strong> — to save or
          submit a rebuttal to Shopify after you approve it.
        </li>
      </ul>

      <h2>What we store</h2>
      <ul>
        <li>
          Your shop&apos;s domain, name and email address, plus your billing
          plan.
        </li>
        <li>
          Dispute records: the details Shopify sends about each dispute (reason,
          status, amounts, ids and deadlines).
        </li>
        <li>
          Evidence packs: an assembled snapshot of the disputed order, which
          includes the customer&apos;s name, email address, shipping and billing
          addresses, IP address, card brand and last four digits only, and
          tracking numbers.
        </li>
        <li>Draft rebuttals and their version history.</li>
        <li>
          An activity log: an audit trail of syncs, drafted responses, edits and
          submissions.
        </li>
        <li>
          Session tokens, stored server side and tied to your Shopify session.
        </li>
      </ul>

      <h2>AI drafting (Anthropic)</h2>
      <p>
        If you have AI drafts enabled, the evidence pack for a dispute is sent
        to Anthropic to have Claude draft a rebuttal. This happens only for the
        evidence pack being drafted; per Anthropic&apos;s commercial terms the
        content is not used to train their models. When AI drafts are disabled,
        rebuttals are generated from templates on our own servers and nothing is
        sent to Anthropic.
      </p>

      <h2>Hosting</h2>
      <p>
        StorePilot is hosted on infrastructure provided by Fly.io or Render
        (depending on deployment), with data stored on a persistent volume in
        the deployment region.
      </p>

      <h2>Retention and deletion</h2>
      <ul>
        <li>
          Dispute data is kept while the app is installed on your shop.
        </li>
        <li>
          If a customer submits a <strong>customers/redact</strong> request, we
          scrub that customer&apos;s personal information from our evidence
          packs.
        </li>
        <li>
          If you uninstall the app, a <strong>shop/redact</strong> request
          deletes everything stored for your shop within 48 hours.
        </li>
        <li>
          If a customer submits a <strong>customers/data_request</strong>, we
          answer with what we hold about that customer.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <p>
        We do not sell your data or your customers&apos; data, and we do not set
        tracking cookies beyond the session Shopify itself manages.
      </p>

      <h2>Security</h2>
      <p>
        All traffic uses TLS in transit, and session tokens are stored server
        side rather than in the browser.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update this page and revise the
        &ldquo;Last updated&rdquo; date above.
      </p>

      <p>
        <a href="/">Back to StorePilot</a>
      </p>
    </main>
  );
}
