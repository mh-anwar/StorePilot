import { seed } from "@/lib/seed";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: Request) {
  // Must have access code
  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.json(
      { error: "ACCESS_CODE not configured" },
      { status: 500 }
    );
  }

  const code = req.headers.get("x-access-code");
  if (code !== accessCode) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(databaseUrl);

  // Check if already seeded
  const existing = await sql`SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products'`;
  const hasTable = Number(existing[0]?.cnt) > 0;

  if (hasTable) {
    const productCount = await sql`SELECT COUNT(*) as cnt FROM products`;
    if (Number(productCount[0]?.cnt) > 0) {
      return NextResponse.json({
        message: "Database already seeded",
        products: Number(productCount[0]?.cnt),
      });
    }
  }

  // Create enums
  await sql`DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending','confirmed','shipped','delivered','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE product_status AS ENUM ('active','draft','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE analytics_event_type AS ENUM ('page_view','product_view','add_to_cart','remove_from_cart','begin_checkout','purchase','search','refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE message_role AS ENUM ('user','assistant','system','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  // Create tables
  await sql`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL UNIQUE, description TEXT, category VARCHAR(100) NOT NULL, price NUMERIC(10,2) NOT NULL, compare_at_price NUMERIC(10,2), cost_per_item NUMERIC(10,2), sku VARCHAR(100) NOT NULL UNIQUE, barcode VARCHAR(100), stock INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER DEFAULT 10, status product_status NOT NULL DEFAULT 'active', tags JSONB DEFAULT '[]', seo_title VARCHAR(160), seo_description VARCHAR(320), image_url VARCHAR(500), vendor VARCHAR(255), weight NUMERIC(8,2), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, phone VARCHAR(20), city VARCHAR(100), state VARCHAR(100), country VARCHAR(2) DEFAULT 'US', total_orders INTEGER DEFAULT 0, total_spent NUMERIC(12,2) DEFAULT 0, tags JSONB DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, order_number VARCHAR(20) NOT NULL UNIQUE, customer_id INTEGER NOT NULL REFERENCES customers(id), status order_status NOT NULL DEFAULT 'pending', subtotal NUMERIC(12,2) NOT NULL, tax NUMERIC(10,2) NOT NULL DEFAULT 0, shipping_cost NUMERIC(10,2) DEFAULT 0, discount NUMERIC(10,2) DEFAULT 0, total NUMERIC(12,2) NOT NULL, currency VARCHAR(3) DEFAULT 'USD', shipping_address JSONB, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), product_name VARCHAR(255) NOT NULL, quantity INTEGER NOT NULL, unit_price NUMERIC(10,2) NOT NULL, total_price NUMERIC(10,2) NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS analytics_events (id SERIAL PRIMARY KEY, event_type analytics_event_type NOT NULL, session_id VARCHAR(64), customer_id INTEGER REFERENCES customers(id), product_id INTEGER REFERENCES products(id), order_id INTEGER REFERENCES orders(id), properties JSONB DEFAULT '{}', referrer VARCHAR(500), utm_source VARCHAR(100), utm_medium VARCHAR(100), utm_campaign VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, title VARCHAR(255), summary TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE, role message_role NOT NULL, content TEXT NOT NULL, tool_invocations JSONB, agent_name VARCHAR(50), metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`;

  const stats = await seed(databaseUrl);
  return NextResponse.json({ success: true, stats });
}
