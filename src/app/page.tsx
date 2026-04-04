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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const agents = [
  {
    name: "Analytics Agent",
    description:
      "Revenue trends, top products, customer segments, traffic sources, and anomaly detection.",
    icon: BarChart3,
    color: "from-blue-500 to-blue-600",
  },
  {
    name: "Content Agent",
    description:
      "Product descriptions, SEO optimization, pricing analysis, and bulk listing improvements.",
    icon: FileText,
    color: "from-purple-500 to-purple-600",
  },
  {
    name: "Inventory Agent",
    description:
      "Stock alerts, restock recommendations, demand forecasting, and inventory updates.",
    icon: Package,
    color: "from-amber-500 to-amber-600",
  },
  {
    name: "Marketing Agent",
    description:
      "Campaign planning, email copy, social media posts, and discount strategies.",
    icon: Megaphone,
    color: "from-green-500 to-green-600",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            AI-Powered Commerce Platform
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Meet{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              StorePilot
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A multi-agent AI copilot that helps you manage your entire
            e-commerce store through natural language. Analyze data, create
            content, manage inventory, and run marketing — all from one
            conversation.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/chat">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Start Chatting
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">
          Four Specialized Agents
        </h2>
        <p className="text-muted-foreground text-center mb-10">
          Each agent is an expert in its domain, with real database access and
          AI-powered tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                className="border border-border rounded-xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-2">Built With</h2>
          <p className="text-muted-foreground mb-8">
            Modern stack optimized for serverless deployment
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Next.js 15",
              "TypeScript",
              "Vercel AI SDK",
              "Claude API",
              "Drizzle ORM",
              "Neon Postgres",
              "Tailwind CSS",
              "shadcn/ui",
              "Framer Motion",
            ].map((tech) => (
              <span
                key={tech}
                className="bg-muted rounded-full px-4 py-1.5 text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
