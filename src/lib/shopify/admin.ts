// Thin wrapper around the Shopify Admin GraphQL API. Handles auth header,
// JSON parsing, rate-limit backoff (THROTTLED errorCode), and retries.
import { SHOPIFY_API_VERSION } from "./config";
import { db } from "../db";
import { shops } from "../db/schema";
import { eq } from "drizzle-orm";
import { getSecret } from "../crypto";

export type AdminContext = {
  shopId: string;
  shopDomain: string;
  accessToken: string;
  orgId: string;
};

export async function adminContext(shopId: string): Promise<AdminContext> {
  const [s] = await db.select().from(shops).where(eq(shops.id, shopId));
  if (!s) throw new Error(`unknown shop ${shopId}`);
  const token = await getSecret(s.orgId, `shopify:${s.id}:token`);
  if (!token) throw new Error(`no access token for shop ${shopId}`);
  return {
    shopId: s.id,
    shopDomain: s.shopDomain,
    accessToken: token,
    orgId: s.orgId,
  };
}

export async function adminGraphql<T = unknown>(
  ctx: AdminContext,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const url = `https://${ctx.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ctx.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429) {
      const retry = Number(r.headers.get("retry-after") || "2");
      await sleep(retry * 1000);
      continue;
    }
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`admin graphql ${r.status}: ${body}`);
    }
    const body = (await r.json()) as {
      data?: T;
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };
    if (body.errors?.length) {
      const throttled = body.errors.some(
        (e) => e.extensions?.code === "THROTTLED"
      );
      if (throttled) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(
        `admin graphql errors: ${body.errors.map((e) => e.message).join("; ")}`
      );
    }
    if (!body.data) throw new Error("admin graphql returned no data");
    return body.data;
  }
  throw new Error("admin graphql: retries exhausted");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
