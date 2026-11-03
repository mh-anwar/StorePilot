// Shop lifecycle: install, refresh of store details/policies, uninstall.

import type { Shop } from "@prisma/client";
import prisma from "../db.server";
import { DEMO_SHOP_DOMAIN } from "./demo/fixtures";
import { logActivity, type StoreContext } from "./context.server";
import { syncDisputes } from "./disputes/sync.server";
import type { AdminClient } from "./shopify/admin-client";
import { fetchShop } from "./shopify/api.server";
import { policiesFromShop } from "./shopify/normalize";

export async function ensureShop(domain: string, opts: { isDemo?: boolean } = {}): Promise<Shop> {
  // The public demo owns this domain; a real store must never share its rows.
  if (domain === DEMO_SHOP_DOMAIN && !opts.isDemo) throw new Error("Reserved demo shop domain");
  return prisma.shop.upsert({
    where: { domain },
    create: { domain, isDemo: opts.isDemo ?? false },
    update: {},
  });
}

/** Pulls name, email, currency and policies. Policies the merchant typed into
 * settings win over the store's published ones. */
export async function refreshShopDetails(shop: Shop, admin: AdminClient): Promise<Shop> {
  const remote = await fetchShop(admin);
  const policies = policiesFromShop(remote);
  return prisma.shop.update({
    where: { id: shop.id },
    data: {
      name: remote.name,
      email: remote.email ?? null,
      currencyCode: remote.currencyCode,
      refundPolicy: shop.refundPolicy ?? policies.refund,
      shippingPolicy: shop.shippingPolicy ?? policies.shipping,
      supportEmail: shop.supportEmail ?? remote.email ?? null,
    },
  });
}

/**
 * Runs after every successful OAuth / token exchange (shopify.server afterAuth).
 * Cheap when nothing changed, so it is fine that it runs on re-auth too.
 */
export async function onInstalled(domain: string, client: AdminClient) {
  const existing = await prisma.shop.findUnique({ where: { domain } });
  const reinstall = Boolean(existing?.uninstalledAt);
  let shop = await ensureShop(domain);
  if (reinstall || !existing) {
    shop = await prisma.shop.update({
      where: { id: shop.id },
      data: { uninstalledAt: null, installedAt: new Date() },
    });
  }
  const ctx: StoreContext = { shop, admin: client, actor: "system", isDemo: false };
  try {
    ctx.shop = await refreshShopDetails(shop, client);
  } catch (error) {
    console.error(`[install] could not read shop details for ${domain}`, error);
  }
  if (!existing || reinstall) {
    await logActivity(shop.id, "installed", reinstall ? "StorePilot was reinstalled." : "StorePilot was installed.");
    try {
      await syncDisputes(ctx);
    } catch (error) {
      console.error(`[install] initial dispute sync failed for ${domain}`, error);
    }
  }
  return ctx.shop;
}

export async function markUninstalled(domain: string) {
  await prisma.session.deleteMany({ where: { shop: domain } });
  await prisma.shop.updateMany({
    where: { domain, uninstalledAt: null },
    data: { uninstalledAt: new Date() },
  });
}
