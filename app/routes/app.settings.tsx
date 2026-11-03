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
  const data = useLoaderData<typeof loader>();
  // Remount when the saved settings change so the form shows them (e.g. after reloading policies).
  return <SettingsView key={JSON.stringify(data.shop)} data={data} base="/app" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
