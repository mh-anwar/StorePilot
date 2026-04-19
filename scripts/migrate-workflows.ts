// Workflow engine migration. Idempotent.
import { readFileSync } from "fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}
import { neon } from "@neondatabase/serverless";

const SQL = `
DO $$ BEGIN CREATE TYPE workflow_status AS ENUM ('active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_run_status AS ENUM ('queued','running','succeeded','failed','awaiting_approval','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE step_run_status AS ENUM ('pending','running','succeeded','failed','skipped','awaiting_approval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE proposal_status AS ENUM ('pending','approved','rejected','expired','applied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status workflow_status NOT NULL DEFAULT 'active',
  trigger JSONB NOT NULL,              -- { type: 'schedule'|'shopify'|'manual'|'http', ... }
  steps JSONB NOT NULL,                -- ordered list of step definitions
  version INTEGER NOT NULL DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows USING GIN (trigger jsonb_path_ops);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status workflow_run_status NOT NULL DEFAULT 'queued',
  trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,    -- running accumulator of step outputs
  current_step INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wruns_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wruns_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_wruns_org_created ON workflow_runs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS step_runs (
  id SERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_id VARCHAR(80) NOT NULL,
  step_type VARCHAR(80) NOT NULL,
  status step_run_status NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_step_runs_run ON step_runs(run_id, step_index);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id VARCHAR(80),
  action_type VARCHAR(80) NOT NULL,       -- e.g. 'store.create_discount'
  action_config JSONB NOT NULL,           -- resolved inputs ready to execute
  summary TEXT,                           -- human-readable "what this will do"
  rationale TEXT,                         -- LLM reasoning that led here
  status proposal_status NOT NULL DEFAULT 'pending',
  resolver_user_id TEXT REFERENCES users(id),
  resolver_note TEXT,
  resolved_at TIMESTAMPTZ,
  applied_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_org_status ON proposals(org_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_run ON proposals(run_id);

-- Per-org notification destinations (so the workflow step doesn't hardcode secrets)
CREATE TABLE IF NOT EXISTS notification_configs (
  id SERIAL PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,    -- 'email' | 'slack' | 'webhook'
  label VARCHAR(120) NOT NULL,
  config JSONB NOT NULL,        -- { to?: string, webhookUrl?: string, ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_org ON notification_configs(org_id);
`;

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  for (const s of SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    try {
      await sql.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 80));
    } catch (e) {
      console.error("FAIL:", (e as Error).message);
    }
  }
}
main();
