// Download of a customers/data_request export (resource route).
import type { LoaderFunctionArgs } from "react-router";
import { adminContext } from "../lib/app-context.server";
import { privacyExport } from "../lib/handlers.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { ctx } = await adminContext(request);
  return privacyExport(ctx, params.id!);
};
