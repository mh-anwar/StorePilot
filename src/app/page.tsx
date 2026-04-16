import Link from "next/link";
import { ArrowRight, Store, Terminal, Workflow } from "lucide-react";

const asks = [
  { text: "which SKUs are three weeks from running out?", who: "inventory" },
  { text: "rewrite the descriptions for anything under 4 stars.", who: "content" },
  { text: "why did Tuesday's revenue tank?", who: "analytics" },
  { text: "draft a promo for the slow-moving beauty line.", who: "marketing" },
];

const reel = [
  { k: "48", v: "products seeded" },
  { k: "200", v: "customers" },
  { k: "1.2k", v: "orders" },
  { k: "15k+", v: "events" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1a1a1a]">
      {/* Top strip */}
      <div className="border-b border-[#1a1a1a]/10">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#1a1a1a]/70">
          <span>storepilot · an experiment in agentic retail</span>
          <span className="hidden sm:inline">v0.4 · april 2026</span>
        </div>
      </div>

      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-[#faf7f2] font-serif italic text-sm">s</span>
          </div>
          <span className="font-serif text-lg tracking-tight">StorePilot</span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/shop" className="hover:underline underline-offset-4">
            Shop the demo
          </Link>
          <Link href="/dashboard" className="hover:underline underline-offset-4">
            Dashboard
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 bg-[#1a1a1a] text-[#faf7f2] px-4 py-2 rounded-full hover:bg-[#1a1a1a]/90"
          >
            Open chat
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero — editorial, not a card grid */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid grid-cols-12 gap-6 items-end">
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60 mb-6">
            001 — the premise
          </p>
          <h1 className="font-serif tracking-tight leading-[0.95] text-5xl sm:text-6xl md:text-7xl">
            A shopkeeper&rsquo;s copilot.{" "}
            <span className="italic font-normal text-[#b54a23]">
              Not a chatbot,
            </span>{" "}
            not a dashboard. Something in between.
          </h1>
          <p className="mt-8 text-lg text-[#1a1a1a]/75 max-w-xl leading-relaxed">
            Run a storefront, watch its agents work: analytics that notices the
            Tuesday dip, inventory that knows which SKU is three weeks from
            empty, marketing that drafts the promo anyway.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#1a1a1a] text-[#faf7f2] px-5 py-3 rounded-full font-medium"
            >
              <Store className="h-4 w-4" />
              Browse the demo shop
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 border border-[#1a1a1a] px-5 py-3 rounded-full font-medium hover:bg-[#1a1a1a] hover:text-[#faf7f2]"
            >
              <Terminal className="h-4 w-4" />
              Try the agents
            </Link>
          </div>
        </div>
        <aside className="col-span-12 lg:col-span-4 lg:pb-4">
          <div className="relative border border-[#1a1a1a]/15 bg-white p-5 rounded-sm shadow-[6px_6px_0_#1a1a1a]/5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
              things merchants ask
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {asks.map((a) => (
                <li key={a.text} className="flex gap-2">
                  <span className="text-[#b54a23] font-mono">›</span>
                  <span>
                    {a.text}{" "}
                    <span className="text-[10px] font-mono uppercase text-[#1a1a1a]/50 ml-1">
                      [{a.who}]
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {/* Numbers strip */}
      <section className="border-y border-[#1a1a1a]/10 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {reel.map((r) => (
            <div key={r.v} className="flex items-baseline gap-3">
              <span className="font-serif text-4xl">{r.k}</span>
              <span className="text-xs uppercase tracking-wider text-[#1a1a1a]/60">
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What's in the box */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-12 gap-10">
        <div className="col-span-12 md:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
            002 — what&rsquo;s inside
          </p>
          <h2 className="font-serif text-4xl leading-tight mt-4">
            The whole thing, wired end to end.
          </h2>
        </div>
        <div className="col-span-12 md:col-span-8 grid sm:grid-cols-2 gap-x-10 gap-y-8 text-[15px] leading-relaxed">
          {[
            ["Public storefront", "Browse, search, cart, checkout — real orders hit the database."],
            ["Live stock", "SSE pushes stock changes to shoppers as they happen."],
            ["Admin desk", "Products, orders, customers, discounts, collections, reviews."],
            ["AI chat", "Four agents with real Postgres tools, supervised by a planner."],
            ["Automations", "Natural-language jobs that run agents on schedule or on demand."],
            ["Bring your own key", "Drop in an Anthropic key in settings — nothing leaves the browser."],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-serif text-xl">{title}</h3>
              <p className="text-[#1a1a1a]/70 mt-1">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1a1a1a] text-[#faf7f2]">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#faf7f2]/60">
              003 — have a look
            </p>
            <h2 className="font-serif text-5xl leading-tight mt-3 max-w-xl">
              Walk through the shop, then ask an agent what&rsquo;s going on.
            </h2>
          </div>
          <div className="flex gap-3">
            <Link
              href="/shop"
              className="px-5 py-3 rounded-full bg-[#faf7f2] text-[#1a1a1a] font-medium"
            >
              Shop
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-3 rounded-full border border-[#faf7f2] font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/automations"
              className="px-5 py-3 rounded-full border border-[#faf7f2] font-medium inline-flex items-center gap-2"
            >
              <Workflow className="h-4 w-4" /> Automations
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[#1a1a1a]/60">
        <span>© storepilot — a demo, not a product</span>
        <span>neon · next · claude</span>
      </footer>
    </div>
  );
}
