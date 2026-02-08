import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { productsSeed } from "./products";
import { generateCustomers } from "./customers";
import { generateOrders } from "./orders";
import { generateAnalyticsEvents } from "./analytics";

export async function seed(databaseUrl: string) {
  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql, schema });

  console.log("Clearing existing data...");
  await db.delete(schema.analyticsEvents);
  await db.delete(schema.messages);
  await db.delete(schema.threads);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.customers);
  await db.delete(schema.products);

  console.log("Seeding products...");
  const insertedProducts = [];
  for (const p of productsSeed) {
    const sku = `SKU-${p.slug.toUpperCase().replace(/-/g, "-").slice(0, 15)}-${String(productsSeed.indexOf(p) + 1).padStart(3, "0")}`;
    const [inserted] = await db
      .insert(schema.products)
      .values({
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        price: p.price,
        compareAtPrice: p.compareAtPrice || null,
        costPerItem: p.costPerItem,
        sku,
        stock: p.stock,
        lowStockThreshold: 10,
        status: "active",
        tags: p.tags,
        vendor: p.vendor,
        weight: p.weight,
        seoTitle: `${p.name} | StorePilot Demo Store`,
        seoDescription: p.description?.slice(0, 160) || null,
      })
      .returning({ id: schema.products.id });
    insertedProducts.push({
      id: inserted.id,
      name: p.name,
      price: p.price,
      category: p.category,
    });
  }
  console.log(`  Inserted ${insertedProducts.length} products`);

  console.log("Seeding customers...");
  const customerData = generateCustomers(200);
  for (const c of customerData) {
    await db.insert(schema.customers).values(c);
  }
  console.log(`  Inserted ${customerData.length} customers`);

  console.log("Seeding orders...");
  const { orders: orderData, orderItems: orderItemData } = generateOrders(
    insertedProducts,
    customerData.length,
    1200
  );

  const insertedOrders: Array<{
    id: number;
    customerId: number;
    createdAt: Date;
    orderItems: Array<{ productId: number }>;
  }> = [];

  for (let i = 0; i < orderData.length; i++) {
    const o = orderData[i];
    const [inserted] = await db
      .insert(schema.orders)
      .values(o)
      .returning({ id: schema.orders.id });

    const items = orderItemData
      .filter((item) => item.orderIndex === i)
      .map(({ orderIndex, ...rest }) => ({
        ...rest,
        orderId: inserted.id,
      }));

    if (items.length > 0) {
      await db.insert(schema.orderItems).values(items);
    }

    insertedOrders.push({
      id: inserted.id,
      customerId: o.customerId,
      createdAt: o.createdAt,
      orderItems: items.map((it) => ({ productId: it.productId })),
    });
  }
  console.log(`  Inserted ${orderData.length} orders`);

  // Update customer stats
  console.log("Updating customer stats...");
  await db.execute(
    schema.customers.id.getSQL()
      ? (undefined as never)
      : (undefined as never)
  ).catch(() => {});
  // Use raw SQL to update customer totals
  const sqlClient = neon(databaseUrl);
  await sqlClient`
    UPDATE customers SET
      total_orders = sub.cnt,
      total_spent = sub.total
    FROM (
      SELECT customer_id, COUNT(*) as cnt, SUM(total::numeric) as total
      FROM orders
      WHERE status NOT IN ('cancelled', 'refunded')
      GROUP BY customer_id
    ) sub
    WHERE customers.id = sub.customer_id
  `;
  console.log("  Updated customer stats");

  console.log("Seeding analytics events...");
  const analyticsData = generateAnalyticsEvents(
    insertedOrders,
    insertedProducts.length,
    customerData.length
  );

  // Batch insert analytics in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < analyticsData.length; i += chunkSize) {
    const chunk = analyticsData.slice(i, i + chunkSize);
    await db.insert(schema.analyticsEvents).values(chunk);
  }
  console.log(`  Inserted ${analyticsData.length} analytics events`);

  console.log("Seed complete!");
  return {
    products: insertedProducts.length,
    customers: customerData.length,
    orders: orderData.length,
    analyticsEvents: analyticsData.length,
  };
}
