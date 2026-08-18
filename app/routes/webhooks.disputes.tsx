// disputes/create and disputes/update.
import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { handleDisputeWebhook } from "../lib/disputes/sync.server";
import { fromShopifyAdmin } from "../lib/shopify/admin-client";
import type { DisputeWebhookPayload } from "../lib/shopify/normalize";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload, topic } = await authenticate.webhook(request);
  // No admin context means the app was uninstalled; nothing to do.
  if (!admin) return new Response();
  const shopRow = await prisma.shop.findUnique({ where: { domain: shop } });
  if (!shopRow || shopRow.uninstalledAt) return new Response();

  try {
    await handleDisputeWebhook(
      { shop: shopRow, admin: fromShopifyAdmin(admin), actor: "system", isDemo: false },
      payload as DisputeWebhookPayload,
    );
  } catch (error) {
    // Returning 500 makes Shopify retry, which is what we want for transient failures.
    console.error(`[webhook] ${topic} for ${shop} failed`, error);
    return new Response("retry", { status: 500 });
  }
  return new Response();
};
