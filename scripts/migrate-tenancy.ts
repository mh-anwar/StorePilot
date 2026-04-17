// Phase 0 migration: add tenancy (orgs, memberships, users, sessions,
// shops, audit_log, encrypted_secrets, webhook_events, jobs) and attach
// an org_id to every tenant-scoped table. Idempotent.
import { readFileSync } from "fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}
import { neon } from "@neondatabase/serverless";

const SQL = `
-- Core tenancy
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  plan VARCHAR(40) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN CREATE TYPE membership_role AS ENUM ('owner','admin','staff'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- Per-org encrypted secrets (shopify tokens, byo api keys, etc).
CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id SERIAL PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  tag TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, key)
);

-- Shopify store connection
DO $$ BEGIN CREATE TYPE shop_status AS ENUM ('connecting','active','uninstalled','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform VARCHAR(40) NOT NULL DEFAULT 'shopify',
  shop_domain VARCHAR(255) NOT NULL,
  scope TEXT,
  status shop_status NOT NULL DEFAULT 'connecting',
  installed_at TIMESTAMPTZ,
  uninstalled_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, shop_domain)
);
CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(org_id);

-- Shopify webhook events (idempotent by webhook id)
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  webhook_id VARCHAR(128) NOT NULL,
  topic VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, webhook_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_topic ON webhook_events(topic);

-- Audit log: every agent-initiated write
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor VARCHAR(80) NOT NULL, -- "agent:inventory", "user:abc", "automation:42"
  tool_name VARCHAR(120) NOT NULL,
  target VARCHAR(200),
  args JSONB,
  result JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Backfill a demo org so existing seeded rows can be scoped.
INSERT INTO organizations (id, slug, name, plan)
VALUES ('org_demo', 'demo', 'Demo Org', 'free')
ON CONFLICT (id) DO NOTHING;

-- Add org_id to existing tenant tables. Default to the demo org during backfill.
ALTER TABLE products ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE products SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE products ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_org ON products(org_id);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE customers SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE customers ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE orders SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE orders ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(org_id);

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE discounts SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE discounts ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_org ON discounts(org_id);

ALTER TABLE collections ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE collections SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE collections ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collections_org ON collections(org_id);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE reviews SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE reviews ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_org ON reviews(org_id);

ALTER TABLE automations ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE automations SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE automations ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automations_org ON automations(org_id);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE threads SET org_id='org_demo' WHERE org_id IS NULL;
ALTER TABLE threads ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_org ON threads(org_id);

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
UPDATE store_settings SET org_id='org_demo' WHERE org_id IS NULL;

-- Shopify-mirrored ids (optional, present on rows that came from a Shopify sync)
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES shops(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_gid TEXT;
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_gid ON products(shopify_gid);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES shops(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shopify_gid TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shopify_gid ON customers(shopify_gid);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES shops(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_gid TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_gid ON orders(shopify_gid);

ALTER TABLE collections ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES shops(id);
ALTER TABLE collections ADD COLUMN IF NOT EXISTS shopify_gid TEXT;
`;

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  const stmts = SQL.split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of stmts) {
    try {
      await sql.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 80));
    } catch (e) {
      console.error("FAIL:", s.split("\n")[0].slice(0, 80), "::", (e as Error).message);
    }
  }
  console.log("Migration complete.");
}
main();
