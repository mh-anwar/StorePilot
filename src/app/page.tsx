import Link from "next/link";
import { ArrowRight, Workflow, GitBranch, ShieldCheck } from "lucide-react";

const recipes = [
  {
    title: "Fraud triage on every order",
    trigger: "orders/create",
    summary:
      "An LLM reads the order, scores it, routes anything above a threshold to a review queue. Rules can't read a shipping address like a human can — this does.",
  },
  {
    title: "Daily restock plan with approvals",
    trigger: "schedule · 24h",
    summary:
      "Pulls low-stock items, asks an LLM for reorder quantities based on 30-day velocity, drops each recommendation in your Proposals inbox.",
  },
  {
    title: "Auto-reply bad reviews, propose the refund",
    trigger: "review created",
    summary:
      "Drafts a tone-matched response, proposes a discount code or refund amount, routes the approval to whoever's on ops rotation.",
  },
  {
    title: "Slow-mover discount generator",
    trigger: "schedule · weekly",
    summary:
      "Finds products with 45+ days of stock, reasons about competing SKUs, proposes a code + a Klaviyo email segment to target.",
  },
  {
    title: "Tag VIPs the moment they cross $500",
    trigger: "orders/create",
    summary:
      "Simple, but one line of YAML in Flow can't do the downstream: personalized thank-you email and a one-time discount generated per customer.",
  },
  {
    title: "Restock-alert loop with human in the loop",
    trigger: "inventory_levels/update",
    summary:
      "When a SKU crosses its low threshold, the workflow emails purchasing with an LLM-drafted PO. The PO only sends after approval.",
  },
];

const comparison = [
  {
    them: "Shopify Flow",
    they: "rule-based (if X then Y). Can't reason. No LLM steps.",
    us: "LLM steps output structured JSON downstream steps consume.",
  },
  {
    them: "Shopify Sidekick",
    they: "conversational. Acts once, then you're done. No schedule, no state.",
    us: "persistent workflows with triggers, retries, audit log, history.",
  },
  {
    them: "Zapier/Make with GPT blocks",
    they: "generic. No Shopify-aware actions. No approval queue.",
    us: "first-class Shopify Admin API writes. Proposals inbox for anything risky.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1a1a1a]">
      <div className="border-b border-[#1a1a1a]/10">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#1a1a1a]/70">
          <span>storepilot · automations for shopify, with a brain</span>
          <span className="hidden sm:inline">v0.5 · private beta</span>
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
          <Link href="/login" className="hover:underline underline-offset-4">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 bg-[#1a1a1a] text-[#faf7f2] px-4 py-2 rounded-full hover:bg-[#1a1a1a]/90"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60 mb-6">
          001 — the thesis
        </p>
        <h1 className="font-serif tracking-tight leading-[0.95] text-5xl sm:text-6xl md:text-7xl max-w-4xl">
          The automations layer{" "}
          <span className="italic font-normal text-[#b54a23]">
            Shopify Flow should have been
          </span>
          . With an LLM instead of if/then.
        </h1>
        <p className="mt-8 text-lg text-[#1a1a1a]/75 max-w-2xl leading-relaxed">
          Build workflows that trigger on Shopify events, reason with an LLM,
          write back to the store, and stop for approval before anything
          risky ships. Every step, every tool call, logged.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#1a1a1a] text-[#faf7f2] px-5 py-3 rounded-full font-medium"
          >
            <Workflow className="h-4 w-4" />
            Start a workflow
          </Link>
          <Link
            href="/dashboard/workflows"
            className="inline-flex items-center gap-2 border border-[#1a1a1a] px-5 py-3 rounded-full font-medium hover:bg-[#1a1a1a] hover:text-[#faf7f2]"
          >
            See the demo
          </Link>
        </div>
      </section>

      {/* Anatomy */}
      <section className="border-y border-[#1a1a1a]/10 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-12 gap-10 items-start">
          <div className="col-span-12 md:col-span-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
              002 — anatomy
            </p>
            <h2 className="font-serif text-4xl leading-tight mt-4">
              A workflow, piece by piece.
            </h2>
            <p className="text-sm text-[#1a1a1a]/70 mt-3">
              Every workflow has one trigger and an ordered list of steps.
              Each step can be an action, a condition, an LLM reasoning
              call, or a proposal gate.
            </p>
          </div>
          <div className="col-span-12 md:col-span-8 space-y-3">
            <Step n="1" kind="trigger" label="orders/create" />
            <Step n="2" kind="llm.reason" label="score fraud risk → {fraud_score, rationale}" />
            <Step n="3" kind="condition" label="fraud_score > 0.6" />
            <Step n="4" kind="proposal.gate" label="tag customer 'fraud-review' (needs approval)" />
            <Step n="5" kind="notify.email" label="alert ops@company.com" />
          </div>
        </div>
      </section>

      {/* Recipes */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60 mb-2">
          003 — what people build
        </p>
        <h2 className="font-serif text-4xl leading-tight max-w-3xl">
          Things you cannot build in Flow. Not easily, not at all.
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {recipes.map((r) => (
            <div
              key={r.title}
              className="border border-[#1a1a1a]/15 bg-white p-5 rounded-sm"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#1a1a1a]/50">
                trigger: {r.trigger}
              </p>
              <h3 className="font-serif text-xl leading-tight mt-2">
                {r.title}
              </h3>
              <p className="text-sm text-[#1a1a1a]/70 mt-2">{r.summary}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it's different */}
      <section className="border-y border-[#1a1a1a]/10 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60 mb-2">
            004 — versus everything else
          </p>
          <h2 className="font-serif text-4xl leading-tight">
            We read the room. Then we did something different.
          </h2>
          <div className="mt-10 divide-y divide-[#1a1a1a]/10">
            {comparison.map((c) => (
              <div
                key={c.them}
                className="py-6 grid grid-cols-12 gap-6 items-start"
              >
                <div className="col-span-12 md:col-span-3">
                  <p className="font-serif text-xl">{c.them}</p>
                </div>
                <div className="col-span-12 md:col-span-5 text-[#1a1a1a]/70">
                  {c.they}
                </div>
                <div className="col-span-12 md:col-span-4 font-medium">
                  → {c.us}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-12 gap-10">
        <div className="col-span-12 md:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
            005 — trust
          </p>
          <h2 className="font-serif text-4xl leading-tight mt-4">
            Autonomous where you want it. Supervised where it counts.
          </h2>
        </div>
        <div className="col-span-12 md:col-span-8 space-y-6 text-[15px]">
          <Bullet icon={ShieldCheck} title="Proposals inbox" body="Mark any step as 'requires approval'. The workflow stops, an approval lands in your inbox with the resolved action config, and only then does it run. Reject and the run continues with a skipped step." />
          <Bullet icon={GitBranch} title="Versioned workflows" body="Every save bumps the version; runs are pinned to the version that executed them. You can see exactly what rule produced a change a month ago." />
          <Bullet icon={Workflow} title="Tamper-evident audit log" body="Every write an agent makes lands in audit_log with the actor, tool, args, and result. Your ops team gets a real paper trail." />
        </div>
      </section>

      <section className="bg-[#1a1a1a] text-[#faf7f2]">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#faf7f2]/60">
              006 — next
            </p>
            <h2 className="font-serif text-5xl leading-tight mt-3 max-w-xl">
              Hook up a Shopify store, pick a template, ship a workflow.
            </h2>
          </div>
          <div className="flex gap-3">
            <Link
              href="/signup"
              className="px-5 py-3 rounded-full bg-[#faf7f2] text-[#1a1a1a] font-medium"
            >
              Create account
            </Link>
            <Link
              href="/dashboard/workflows"
              className="px-5 py-3 rounded-full border border-[#faf7f2] font-medium"
            >
              Browse demo workflows
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[#1a1a1a]/60">
        <span>© storepilot</span>
        <span>neon · next · claude</span>
      </footer>
    </div>
  );
}

function Step({ n, kind, label }: { n: string; kind: string; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-[#1a1a1a]/10 bg-[#faf7f2] rounded-sm px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#1a1a1a]/50 w-4">
        {n}
      </span>
      <span className="font-mono text-xs bg-[#1a1a1a] text-[#faf7f2] px-2 py-0.5 rounded">
        {kind}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function Bullet({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <Icon className="h-5 w-5 mt-1 text-[#b54a23] shrink-0" />
      <div>
        <p className="font-serif text-xl">{title}</p>
        <p className="text-[#1a1a1a]/70 mt-1">{body}</p>
      </div>
    </div>
  );
}
