import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { SettingsView } from "../components/SettingsView";
import { adminContext } from "../lib/app-context.server";
import { settingsAction, settingsLoader } from "../lib/handlers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return settingsLoader(ctx);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return settingsAction(ctx, request);
};

export default function Settings() {
  return <SettingsView data={useLoaderData<typeof loader>()} base="/app" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
