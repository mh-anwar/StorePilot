// Every server-side operation runs against a StoreContext: which shop, how to
// reach its Admin API, and who is acting. The embedded app builds one from the
// authenticated session; the demo builds one from seeded data and a mock API.

import type { Shop } from "@prisma/client";
import prisma from "../db.server";
import type { AdminClient } from "./shopify/admin-client";

export interface StoreContext {
  shop: Shop;
  admin: AdminClient;
  /** "system", or the staff member's email when we know it. */
  actor: string;
  isDemo: boolean;
}

export type ActivityKind =
  | "installed"
  | "synced"
  | "dispute_opened"
  | "dispute_updated"
  | "pack_built"
  | "drafted"
  | "edited"
  | "saved"
  | "submitted"
  | "decided"
  | "outcome"
  | "plan_changed"
  | "gdpr"
  | "alerted"
  | "error";

export async function logActivity(
  shopId: string,
  kind: ActivityKind,
  message: string,
  opts: { disputeId?: string | null; actor?: string | null; meta?: unknown } = {},
) {
  return prisma.activity.create({
    data: {
      shopId,
      kind,
      message,
      disputeId: opts.disputeId ?? null,
      actor: opts.actor ?? "system",
      meta: opts.meta === undefined ? null : JSON.stringify(opts.meta),
    },
  });
}
