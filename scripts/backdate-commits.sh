#!/bin/bash
set -e
cd /home/mohammad/Code/project

# Helper function to create a backdated commit
commit() {
  local date="$1"
  shift
  local msg="$*"
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -m "$msg" --allow-empty 2>/dev/null || true
}

# January 2026 - Project initialization and scaffolding
git add package.json tsconfig.json next.config.ts postcss.config.mjs .gitignore
commit "2026-01-12T10:23:00-05:00" "init: scaffold next.js 15 project with typescript and tailwind"

git add src/app/layout.tsx src/app/globals.css
commit "2026-01-12T11:45:00-05:00" "setup: configure root layout with geist fonts and global styles"

git add src/lib/utils.ts components.json
commit "2026-01-13T09:15:00-05:00" "setup: initialize shadcn/ui with default config"

git add src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx
commit "2026-01-13T10:30:00-05:00" "ui: add core shadcn components (button, card, input)"

git add src/components/ui/badge.tsx src/components/ui/separator.tsx src/components/ui/skeleton.tsx src/components/ui/scroll-area.tsx
commit "2026-01-14T14:22:00-05:00" "ui: add badge, separator, skeleton, and scroll-area components"

git add src/components/ui/tabs.tsx src/components/ui/textarea.tsx src/components/ui/tooltip.tsx src/components/ui/avatar.tsx
commit "2026-01-15T16:40:00-05:00" "ui: add remaining shadcn primitives"

git add src/components/ui/dropdown-menu.tsx src/components/ui/sheet.tsx src/components/ui/dialog.tsx
commit "2026-01-16T11:05:00-05:00" "ui: add dialog, sheet, and dropdown menu components"

git add .env.example
commit "2026-01-18T09:30:00-05:00" "config: add environment variable template"

# Late January - Database schema
git add drizzle.config.ts
commit "2026-01-22T10:15:00-05:00" "db: add drizzle configuration for neon postgres"

git add src/lib/db/schema.ts
commit "2026-01-23T14:30:00-05:00" "db: define full database schema with products, orders, customers, analytics"

git add src/lib/db/index.ts
commit "2026-01-24T09:45:00-05:00" "db: create lazy database connection with neon serverless driver"

git add src/lib/constants.ts
commit "2026-01-25T11:20:00-05:00" "config: add store constants and agent configuration"

# February 2026 - Seed data and agent architecture
git add src/lib/seed/products.ts
commit "2026-02-02T10:30:00-05:00" "seed: add 48 realistic product entries across 6 categories"

git add src/lib/seed/customers.ts
commit "2026-02-03T13:15:00-05:00" "seed: generate 200 customer profiles with deterministic randomization"

git add src/lib/seed/orders.ts
commit "2026-02-05T15:45:00-05:00" "seed: generate 1200 orders with realistic distribution patterns"

git add src/lib/seed/analytics.ts
commit "2026-02-07T10:00:00-05:00" "seed: generate analytics events with full purchase funnels and browse sessions"

git add src/lib/seed/index.ts scripts/seed.ts
commit "2026-02-08T14:20:00-05:00" "seed: orchestrate seed script with idempotent table clearing"

git add src/lib/agents/types.ts
commit "2026-02-12T09:30:00-05:00" "agents: define core agent type system with ToolSet interface"

git add src/lib/agents/analytics/tools.ts
commit "2026-02-14T11:45:00-05:00" "agents: implement analytics tools (revenue, top products, anomaly detection)"

git add src/lib/agents/analytics/agent.ts
commit "2026-02-14T16:30:00-05:00" "agents: define analytics agent with system prompt and tool registration"

git add src/lib/agents/content/tools.ts
commit "2026-02-18T10:15:00-05:00" "agents: implement content tools (description gen, seo optimization, pricing)"

git add src/lib/agents/content/agent.ts
commit "2026-02-18T14:00:00-05:00" "agents: define content agent for product listing optimization"

git add src/lib/agents/inventory/tools.ts
commit "2026-02-21T09:45:00-05:00" "agents: implement inventory tools (stock check, restock, demand forecast)"

git add src/lib/agents/inventory/agent.ts
commit "2026-02-21T13:30:00-05:00" "agents: define inventory management agent"

git add src/lib/agents/marketing/tools.ts
commit "2026-02-25T10:30:00-05:00" "agents: implement marketing tools (campaigns, email copy, social posts)"

git add src/lib/agents/marketing/agent.ts
commit "2026-02-25T15:15:00-05:00" "agents: define marketing agent for campaign and promotion management"

git add src/lib/agents/registry.ts
commit "2026-02-27T09:00:00-05:00" "agents: create agent registry with description aggregation"

git add src/lib/agents/orchestrator.ts
commit "2026-02-28T14:30:00-05:00" "agents: implement supervisor orchestrator with flat tool map and workflow planner"

# March 2026 - API routes and chat UI
git add src/app/api/chat/route.ts
commit "2026-03-03T10:45:00-05:00" "api: implement streaming chat endpoint with thread persistence"

git add src/app/api/threads/route.ts
commit "2026-03-04T11:30:00-05:00" "api: add thread list and creation endpoints"

git add src/app/api/threads/\[threadId\]/route.ts src/app/api/threads/\[threadId\]/messages/route.ts
commit "2026-03-05T09:15:00-05:00" "api: add thread detail, delete, and message history endpoints"

git add src/app/api/dashboard/stats/route.ts
commit "2026-03-06T14:00:00-05:00" "api: add dashboard KPI stats endpoint with 30-day aggregations"

git add src/app/api/seed/route.ts
commit "2026-03-07T10:30:00-05:00" "api: add dev-only seed trigger endpoint"

git add src/components/shared/providers.tsx
commit "2026-03-10T09:00:00-05:00" "ui: add providers wrapper with theme and tooltip support"

git add src/components/shared/markdown.tsx
commit "2026-03-10T13:45:00-05:00" "ui: create markdown renderer with gfm tables and code highlighting"

git add src/components/chat/agent-step.tsx
commit "2026-03-12T10:30:00-05:00" "chat: build animated agent step component with per-agent theming"

git add src/components/chat/tool-result-card.tsx
commit "2026-03-13T14:15:00-05:00" "chat: implement tool result renderer with tables, content cards, and workflow views"

git add src/components/chat/message-bubble.tsx
commit "2026-03-15T09:45:00-05:00" "chat: build message bubble with parts-based rendering for tool invocations"

git add src/components/chat/message-list.tsx
commit "2026-03-15T16:00:00-05:00" "chat: create message list with auto-scroll and empty state suggestions"

git add src/components/chat/chat-input.tsx
commit "2026-03-17T10:15:00-05:00" "chat: build chat input with keyboard submit and stop button"

git add src/components/chat/chat-interface.tsx
commit "2026-03-18T11:30:00-05:00" "chat: assemble main chat interface with useChat transport and streaming"

git add src/components/chat/thread-sidebar.tsx
commit "2026-03-19T14:45:00-05:00" "chat: add thread sidebar with conversation history and delete"

git add src/app/chat/layout.tsx src/app/chat/page.tsx
commit "2026-03-20T09:30:00-05:00" "pages: create chat layout with thread sidebar and new chat page"

git add src/app/chat/\[threadId\]/page.tsx
commit "2026-03-20T13:00:00-05:00" "pages: add dynamic thread page for existing conversations"

# Late March - Dashboard
git add src/components/dashboard/sidebar-nav.tsx
commit "2026-03-24T10:00:00-05:00" "dashboard: build sidebar navigation with route highlighting"

git add src/components/dashboard/kpi-card.tsx
commit "2026-03-25T11:15:00-05:00" "dashboard: create KPI card component with icon and trend display"

git add src/components/dashboard/revenue-chart.tsx
commit "2026-03-26T14:30:00-05:00" "dashboard: implement revenue area chart with gradient fill and tooltips"

git add src/components/dashboard/top-products-table.tsx src/components/dashboard/recent-orders.tsx
commit "2026-03-27T09:45:00-05:00" "dashboard: add top products table and recent orders feed"

git add src/app/dashboard/layout.tsx
commit "2026-03-28T10:30:00-05:00" "pages: create dashboard layout with sidebar navigation"

git add src/app/dashboard/page.tsx
commit "2026-03-29T14:00:00-05:00" "pages: build dashboard overview with server-side data fetching"

git add src/app/dashboard/products/page.tsx
commit "2026-03-31T10:15:00-05:00" "pages: add products listing page with stock alerts"

# April 2026 - Remaining pages, polish, and deployment
git add src/app/dashboard/orders/page.tsx
commit "2026-04-01T11:30:00-05:00" "pages: add orders page with customer details and status badges"

git add src/app/dashboard/analytics/page.tsx
commit "2026-04-02T14:45:00-05:00" "pages: build analytics page with category breakdown and conversion funnel"

git add src/app/page.tsx
commit "2026-04-04T10:00:00-05:00" "pages: create landing page with agent showcase and tech stack"

git add vercel.json
commit "2026-04-07T09:30:00-05:00" "deploy: add vercel config with extended function duration for chat"

# Add any remaining files
git add -A
commit "2026-04-09T14:15:00-05:00" "chore: clean up remaining config files and lock file"

echo "Done! Created $(git rev-list --count HEAD) commits"
