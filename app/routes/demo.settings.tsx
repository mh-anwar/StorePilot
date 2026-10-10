import type { ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { SettingsView } from "../components/SettingsView";
import { demoContext } from "../lib/demo/demo.server";
import { settingsAction, settingsLoader } from "../lib/handlers.server";

export const loader = async () => settingsLoader(await demoContext());
export const action = async ({ request }: ActionFunctionArgs) => settingsAction(await demoContext(), request);

export default function DemoSettings() {
  return <SettingsView data={useLoaderData<typeof loader>()} base="/demo" />;
}
