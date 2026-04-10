# StorePilot

An AI-powered multi-agent commerce platform that helps merchants manage their online store through natural language conversation.

## Architecture

StorePilot uses a **supervisor-agent pattern** where a central orchestrator delegates to four specialized sub-agents, each with typed tools that query a real PostgreSQL database:

- **Analytics Agent** — Revenue trends, top products, customer segmentation, traffic analysis, anomaly detection
- **Content Agent** — Product description generation, SEO optimization, pricing analysis, bulk listing improvements
- **Inventory Agent** — Stock monitoring, restock recommendations, demand forecasting, inventory updates
- **Marketing Agent** — Campaign planning, email copywriting, social media content, discount strategies

The orchestrator uses a **flat tool map** approach — all agent tools are namespaced (e.g., `analytics__query_revenue`) and available in a single `streamText` call with `stepCountIs(10)` for multi-step reasoning. This avoids the latency of nested LLM calls while maintaining clear agent boundaries in the UI.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components, Turbopack)
- **Language**: TypeScript
- **AI**: Vercel AI SDK v6 + Claude API (claude-sonnet-4-20250514)
- **Database**: Neon Postgres (serverless) + Drizzle ORM
- **UI**: Tailwind CSS v4 + shadcn/ui + Framer Motion
- **Charts**: Recharts
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- [Neon](https://neon.tech) database
- [Anthropic API key](https://console.anthropic.com)

### Setup

```bash
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and ANTHROPIC_API_KEY

# Push schema to database
pnpm db:push

# Seed with demo data (48 products, 200 customers, 1200 orders, 15k+ analytics events)
pnpm db:seed

# Start dev server
pnpm dev
```

### Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/chat/          # Streaming chat endpoint
│   ├── api/threads/       # Conversation thread CRUD
│   ├── api/dashboard/     # Dashboard data endpoints
│   ├── chat/              # AI chat interface
│   └── dashboard/         # Store dashboard pages
├── components/
│   ├── chat/              # Chat UI (message bubbles, agent steps, tool results)
│   ├── dashboard/         # Dashboard components (KPIs, charts, tables)
│   ├── shared/            # Providers, markdown renderer
│   └── ui/                # shadcn/ui primitives
└── lib/
    ├── agents/            # Multi-agent system
    │   ├── orchestrator.ts  # Supervisor with flat tool map
    │   ├── registry.ts      # Agent registration
    │   ├── analytics/       # Analytics agent + 7 tools
    │   ├── content/         # Content agent + 4 tools
    │   ├── inventory/       # Inventory agent + 4 tools
    │   └── marketing/       # Marketing agent + 4 tools
    ├── db/                # Drizzle schema and connection
    └── seed/              # Deterministic seed data generators
```

## Deployment

Deploy to Vercel with the Neon Postgres integration:

```bash
vercel --prod
```

Set `DATABASE_URL` and `ANTHROPIC_API_KEY` in your Vercel project environment variables.

## License

MIT
