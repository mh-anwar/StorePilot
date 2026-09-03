import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { DisputeView } from "../components/DisputeView";
import { demoContext } from "../lib/demo/demo.server";
import { detailAction, detailLoader } from "../lib/handlers.server";
import { UserFacingError } from "../lib/errors";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  try {
    return await detailLoader(await demoContext(), params.id!);
  } catch (error) {
    // The demo resets itself; old links should land on the inbox, not a 500.
    if (error instanceof UserFacingError) throw new Response(null, { status: 302, headers: { Location: "/demo" } });
    throw error;
  }
};
export const action = async ({ request, params }: ActionFunctionArgs) =>
  detailAction(await demoContext(), params.id!, request);

export default function DemoDispute() {
  const data = useLoaderData<typeof loader>();
  return <DisputeView key={data.dispute.id} data={data} base="/demo" />;
}
