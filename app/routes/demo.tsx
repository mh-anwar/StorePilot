// The public demo: the same screens as the embedded app, outside Shopify
// admin, on a seeded store with a mocked Admin API.
import type { MetaFunction } from "react-router";
import { Form, Outlet, useLoaderData, useLocation } from "react-router";
import { demoContext } from "../lib/demo/demo.server";

export const meta: MetaFunction = () => [{ title: "StorePilot demo" }];

export const loader = async () => {
  const ctx = await demoContext();
  return { shopName: ctx.shop.name ?? ctx.shop.domain, plan: ctx.shop.plan };
};

const NAV = [
  { href: "/demo", label: "Disputes" },
  { href: "/demo/settings", label: "Settings" },
  { href: "/demo/billing", label: "Plans" },
];

export default function DemoLayout() {
  const { shopName } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  return (
    <>
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      <style>{`
        body { margin: 0; background: #f1f1f1; }
        .sp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 10px 20px; background: #1a1a1a; color: #e3e3e3; font: 13px/1.4 Inter, system-ui, sans-serif; }
        .sp-bar strong { color: #fff; font-size: 14px; }
        .sp-bar a { color: #e3e3e3; text-decoration: none; padding: 4px 8px; border-radius: 6px; }
        .sp-bar a[aria-current=page], .sp-bar a:hover { background: #303030; color: #fff; }
        .sp-bar .sp-grow { flex: 1; }
        .sp-bar button { font: inherit; color: #1a1a1a; background: #e3e3e3; border: 0; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
        .sp-bar button:hover { background: #fff; }
        .sp-bar form { display: inline; }
        .sp-note { color: #b5b5b5; }
      `}</style>
      <nav className="sp-bar" aria-label="Demo">
        <strong>StorePilot</strong>
        <span className="sp-note">{`Demo store · ${shopName}`}</span>
        {NAV.map((n) => (
          <a key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
            {n.label}
          </a>
        ))}
        <span className="sp-grow" />
        <Form method="post" action="/demo/simulate">
          <button name="intent" value="new_dispute">Simulate a new dispute</button>
        </Form>
        <Form method="post" action="/demo/simulate">
          <button name="intent" value="decide">Simulate bank decisions</button>
        </Form>
        <Form method="post" action="/demo/simulate">
          <button name="intent" value="reset">Reset demo</button>
        </Form>
      </nav>
      <Outlet />
    </>
  );
}
