import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "draft",
  "archived",
]);

export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "page_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "purchase",
  "search",
  "refund",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
    costPerItem: numeric("cost_per_item", { precision: 10, scale: 2 }),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    barcode: varchar("barcode", { length: 100 }),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").default(10),
    status: productStatusEnum("status").notNull().default("active"),
    tags: jsonb("tags").$type<string[]>().default([]),
    seoTitle: varchar("seo_title", { length: 160 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    imageUrl: varchar("image_url", { length: 500 }),
    vendor: varchar("vendor", { length: 255 }),
    weight: numeric("weight", { precision: 8, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_products_category").on(t.category),
    index("idx_products_status").on(t.status),
  ]
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 2 }).default("US"),
    totalOrders: integer("total_orders").default(0),
    totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).default(
      "0"
    ),
    tags: jsonb("tags").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_customers_email").on(t.email)]
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
    shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).default(
      "0"
    ),
    discount: numeric("discount", { precision: 10, scale: 2 }).default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    shippingAddress: jsonb("shipping_address").$type<{
      line1: string;
      line2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    }>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_orders_customer").on(t.customerId),
    index("idx_orders_status").on(t.status),
    index("idx_orders_created_at").on(t.createdAt),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [
    index("idx_order_items_order").on(t.orderId),
    index("idx_order_items_product").on(t.productId),
  ]
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    eventType: analyticsEventTypeEnum("event_type").notNull(),
    sessionId: varchar("session_id", { length: 64 }),
    customerId: integer("customer_id").references(() => customers.id),
    productId: integer("product_id").references(() => products.id),
    orderId: integer("order_id").references(() => orders.id),
    properties: jsonb("properties")
      .$type<Record<string, unknown>>()
      .default({}),
    referrer: varchar("referrer", { length: 500 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_analytics_event_type").on(t.eventType),
    index("idx_analytics_created_at").on(t.createdAt),
    index("idx_analytics_product").on(t.productId),
  ]
);

export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
  title: varchar("title", { length: 255 }),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "free_shipping",
]);

export const discounts = pgTable(
  "discounts",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    description: text("description"),
    type: discountTypeEnum("type").notNull().default("percentage"),
    value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
    minSubtotal: numeric("min_subtotal", { precision: 10, scale: 2 }),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_discounts_code").on(t.code)]
);

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 500 }),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const productCollections = pgTable(
  "product_collections",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_pc_product").on(t.productId),
    index("idx_pc_collection").on(t.collectionId),
  ]
);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id),
    authorName: varchar("author_name", { length: 100 }).notNull(),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 200 }),
    body: text("body"),
    status: reviewStatusEnum("status").notNull().default("approved"),
    helpful: integer("helpful").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_reviews_product").on(t.productId),
    index("idx_reviews_status").on(t.status),
  ]
);

export const automationTriggerEnum = pgEnum("automation_trigger", [
  "schedule",
  "low_stock",
  "new_order",
  "manual",
]);

export const automationStatusEnum = pgEnum("automation_status", [
  "active",
  "paused",
]);

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  trigger: automationTriggerEnum("trigger").notNull().default("manual"),
  triggerConfig: jsonb("trigger_config")
    .$type<Record<string, unknown>>()
    .default({}),
  prompt: text("prompt").notNull(),
  status: automationStatusEnum("status").notNull().default("active"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "running",
  "succeeded",
  "failed",
]);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: serial("id").primaryKey(),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: automationRunStatusEnum("status").notNull().default("running"),
    output: text("output"),
    error: text("error"),
    toolCalls: jsonb("tool_calls").$type<
      Array<{ name: string; args: unknown; result?: unknown }>
    >(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("idx_runs_automation").on(t.automationId)]
);

export const carts = pgTable("carts", {
  id: text("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  discountCode: varchar("discount_code", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("idx_cart_items_cart").on(t.cartId)]
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 200 }),
    actor: varchar("actor", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_invadj_product").on(t.productId)]
);

export const storeSettings = pgTable("store_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolInvocations: jsonb("tool_invocations").$type<
      Array<{
        toolName: string;
        args: Record<string, unknown>;
        result?: unknown;
        state: "call" | "result" | "partial-call";
      }>
    >(),
    agentName: varchar("agent_name", { length: 50 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_messages_thread").on(t.threadId),
    index("idx_messages_created_at").on(t.createdAt),
  ]
);
