// app/uninstalled: drop the access token straight away. Dispute data stays
// until Shopify sends shop/redact (48 hours later), so a quick reinstall
// doesn't lose the merchant's history.
import type { ActionFunctionArgs } from "react-router";
import { markUninstalled } from "../lib/shop.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  await markUninstalled(shop);
  return new Response();
};
