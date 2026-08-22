import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { DisputeView } from "../components/DisputeView";
import { adminContext } from "../lib/app-context.server";
import { detailAction, detailLoader } from "../lib/handlers.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return detailLoader(ctx, params.id!);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return detailAction(ctx, params.id!, request);
};

export default function DisputePage() {
  const data = useLoaderData<typeof loader>();
  return <DisputeView key={data.dispute.id} data={data} base="/app" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
