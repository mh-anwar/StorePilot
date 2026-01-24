import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Please configure your environment variables."
    );
  }
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}

// Lazy singleton — only created when first accessed at runtime
let _db: ReturnType<typeof createDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = ReturnType<typeof createDb>;
