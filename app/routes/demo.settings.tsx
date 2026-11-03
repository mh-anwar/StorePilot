import type { ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { SettingsView } from "../components/SettingsView";
import { demoContext } from "../lib/demo/demo.server";
import { settingsAction, settingsLoader } from "../lib/handlers.server";

export const loader = async () => settingsLoader(await demoContext());
export const action = async ({ request }: ActionFunctionArgs) => settingsAction(await demoContext(), request);

export default function DemoSettings() {
  const data = useLoaderData<typeof loader>();
  // Remount when the saved settings change so the form shows them (e.g. after reloading policies).
  return <SettingsView key={JSON.stringify(data.shop)} data={data} base="/demo" />;
}
