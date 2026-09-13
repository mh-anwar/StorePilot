import type { StoreContext } from "../../app/lib/context.server";
import { MockShopifyAdmin, type MockAdminOptions } from "../../app/lib/demo/mock-admin";
import { prisma } from "./db";

// Deadlines are checked against the real clock, so fixtures are relative to now.
export const NOW = new Date();

export async function makeStore(
  opts: { plan?: string; domain?: string; admin?: MockAdminOptions; minFightAmountCents?: number } = {},
): Promise<StoreContext & { admin: MockShopifyAdmin }> {
  const shop = await prisma.shop.create({
    data: {
      domain: opts.domain ?? "test-store.myshopify.com",
      name: "Juniper Trail Outfitters",
      plan: opts.plan ?? "free",
      supportEmail: "help@junipertrail.example.com",
      minFightAmountCents: opts.minFightAmountCents ?? 2000,
    },
  });
  const admin = new MockShopifyAdmin({ now: NOW, ...opts.admin });
  return { shop, admin, actor: "owner@example.com", isDemo: false };
}
