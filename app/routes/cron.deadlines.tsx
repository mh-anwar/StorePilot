import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import { runDeadlineAlerts } from "../lib/alerts/deadlines.server";

// Runs deadline alerts on demand, for hosts that prefer an external scheduler
// to the in-process hourly timer. Disabled unless CRON_SECRET is set; callers
// send `Authorization: Bearer <CRON_SECRET>`. Safe to call often: each
// dispute is emailed at most once per stage.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("Not found", { status: 404 });
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDeadlineAlerts());
}

export const loader = ({ request }: LoaderFunctionArgs) => run(request);
export const action = ({ request }: ActionFunctionArgs) => run(request);
