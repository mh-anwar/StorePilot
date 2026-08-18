// Mandatory privacy webhooks: customers/data_request, customers/redact, shop/redact.
// authenticate.webhook verifies the HMAC and answers 401 for forged requests.
import type { ActionFunctionArgs } from "react-router";
import { handleCompliance } from "../lib/gdpr.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  await handleCompliance(String(topic), shop, payload);
  return new Response();
};
