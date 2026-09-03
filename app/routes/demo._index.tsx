import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Inbox } from "../components/Inbox";
import { demoContext } from "../lib/demo/demo.server";
import { inboxAction, inboxLoader } from "../lib/handlers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => inboxLoader(await demoContext(), request);
export const action = async ({ request }: ActionFunctionArgs) => inboxAction(await demoContext(), request);

export default function DemoInbox() {
  return <Inbox data={useLoaderData<typeof loader>()} base="/demo" />;
}
