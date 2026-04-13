import Link from "next/link";
import {
  BarChart3,
  FileText,
  Package,
  Megaphone,
  Zap,
  ArrowRight,
  MessageSquare,
  LayoutDashboard,
  Bot,
  Database,
  Workflow,
  Shield,
  Globe,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const agents = [
  {
    name: "Analytics Agent",
    description:
      "Revenue trends, top products, customer segments, traffic sources, and anomaly detection.",
    tools: [
      "query_revenue",
      "top_products",
      "revenue_over_time",
      "detect_anomalies",
      "customer_segments",
      "traffic_sources",
      "sales_by_category",
    ],
    icon: BarChart3,
    color: "from-blue-500 to-blue-600",
    borderColor: "hover:border-blue-500/40",
    bgGlow: "group-hover:bg-blue-500/5",
  },
  {
    name: "Content Agent",
    description:
      "Product descriptions, SEO optimization, pricing analysis, and bulk listing improvements.",
    tools: [
      "generate_description",
      "optimize_seo",
      "bulk_improve_listings",
      "suggest_pricing",
    ],
    icon: FileText,
    color: "from-purple-500 to-purple-600",
    borderColor: "hover:border-purple-500/40",
    bgGlow: "group-hover:bg-purple-500/5",
  },
  {
    name: "Inventory Agent",
    description:
      "Stock monitoring, restock recommendations, demand forecasting, and inventory updates.",
    tools: [
      "check_stock_levels",
      "restock_recommendations",
      "update_stock",
      "forecast_demand",
    ],
    icon: Package,
    color: "from-amber-500 to-amber-600",
    borderColor: "hover:border-amber-500/40",
    bgGlow: "group-hover:bg-amber-500/5",
  },
  {
    name: "Marketing Agent",
    description:
      "Campaign planning, email copywriting, social media content, and discount strategies.",
    tools: [
      "generate_campaign",
      "write_email_copy",
      "discount_strategy",
      "social_media_posts",
    ],
    icon: Megaphone,
    color: "from-green-500 to-green-600",
    borderColor: "hover:border-green-500/40",
    bgGlow: "group-hover:bg-green-500/5",
  },
];

const architecture = [
  {
    icon: Bot,
    title: "Supervisor Orchestrator",
    description:
      "A central agent routes requests to specialized sub-agents using a flat tool map — no nested LLM calls.",
  },
  {
    icon: Database,
    title: "Real Database Queries",
    description:
      "Every tool queries a live Postgres database with 1,200+ orders, 200 customers, and 15k analytics events.",
  },
  {
    icon: Workflow,
    title: "Multi-Step Reasoning",
    description:
      "Complex requests are broken into workflows — the orchestrator plans, then executes each step sequentially.",
  },
  {
    icon: Sparkles,
    title: "Streaming Tool Calls",
    description:
      "Watch agents think in real-time — tool calls stream with animated step indicators and rich result cards.",
  },
];

const exampleQueries = [
  "What were my top 5 products by revenue this month?",
  "Which items are about to go out of stock?",
  "Write a product description for the merino wool cardigan",
  "Create a spring sale campaign for my apparel category",
  "Show me customer segments by spend tier",
  "Detect any anomalies in my daily revenue",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold">StorePilot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Dashboard
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700">
                Open Chat
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-400 rounded-full px-3.5 py-1 text-sm font-medium mb-8 border border-violet-500/20">
            <Bot className="h-3.5 w-3.5" />
            Multi-Agent System
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
            AI agents that actually
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              run your store
            </span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Four specialized agents with real database access. Ask about revenue,
            generate product copy, check inventory, plan campaigns — they query
            actual data and give you real answers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/chat">
              <Button
                size="lg"
                className="h-11 px-7 bg-violet-600 hover:bg-violet-700 gap-2 shadow-lg shadow-violet-600/20"
              >
                <MessageSquare className="h-5 w-5" />
                Try the AI Chat
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="h-11 px-7 gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Example Queries */}
      <div className="border-y border-border/50 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-6">
            Things you can ask
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleQueries.map((query) => (
              <Link key={query} href="/chat">
                <span className="inline-block bg-background border border-border/60 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-colors cursor-pointer">
                  &ldquo;{query}&rdquo;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-2">The Agents</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Each one has its own system prompt, typed tools, and domain knowledge.
            The orchestrator picks who handles what.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                className={`group border border-border rounded-2xl p-6 transition-all duration-300 ${agent.borderColor}`}
              >
                <div className={`rounded-2xl transition-colors ${agent.bgGlow} p-0`}>
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 ml-15">
                    {agent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="text-xs font-mono bg-muted/60 text-muted-foreground rounded px-2 py-0.5"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture */}
      <div className="border-t border-border/50 bg-muted/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">Architecture</h2>
            <p className="text-sm text-muted-foreground">
              How the pieces fit together.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {architecture.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/3">
              <h2 className="text-2xl font-bold mb-2">Stack</h2>
              <p className="text-sm text-muted-foreground">
                Serverless-first. Neon for zero cold-start DB,
                Vercel AI SDK for streaming, server components
                where it makes sense.
              </p>
            </div>
            <div className="lg:w-2/3 flex flex-wrap gap-3">
              {[
                { name: "Next.js 15", category: "framework" },
                { name: "TypeScript", category: "language" },
                { name: "Vercel AI SDK v6", category: "ai" },
                { name: "Claude Sonnet", category: "ai" },
                { name: "Drizzle ORM", category: "database" },
                { name: "Neon Postgres", category: "database" },
                { name: "Tailwind CSS v4", category: "ui" },
                { name: "shadcn/ui", category: "ui" },
                { name: "Framer Motion", category: "ui" },
                { name: "Recharts", category: "ui" },
                { name: "Zod", category: "validation" },
              ].map((tech) => (
                <span
                  key={tech.name}
                  className={`rounded-lg px-4 py-2 text-sm font-medium border ${
                    tech.category === "ai"
                      ? "bg-violet-500/10 border-violet-500/20 text-violet-300"
                      : tech.category === "database"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                        : tech.category === "framework" || tech.category === "language"
                          ? "bg-foreground/5 border-foreground/10 text-foreground"
                          : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {tech.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-3">
              Try it out
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Dashboard is open to browse. Chat needs an access code.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/chat">
                <Button
                  size="lg"
                  className="h-11 px-6 bg-violet-600 hover:bg-violet-700 gap-2"
                >
                  <MessageSquare className="h-5 w-5" />
                  Open AI Chat
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="h-11 px-6 gap-2">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 bg-muted/10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            StorePilot
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Access-code protected
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              Deployed on Vercel
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
