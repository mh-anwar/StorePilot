// Builds a StoreContext for an authenticated embedded-app request.

import { authenticate } from "../shopify.server";
import type { StoreContext } from "./context.server";
import { ensureShop } from "./shop.server";
import { fromShopifyAdmin } from "./shopify/admin-client";

export async function adminContext(request: Request) {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const ctx: StoreContext = {
    shop,
    admin: fromShopifyAdmin(admin),
    actor: session.onlineAccessInfo?.associated_user?.email ?? "staff",
    isDemo: false,
  };
  return { ctx, billing, session };
}
