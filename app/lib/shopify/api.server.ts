// Typed wrappers around the GraphQL documents in ./queries. Everything that
// talks to Shopify goes through an AdminClient, so the demo and the tests can
// swap in MockShopifyAdmin without touching this file.

import type { AdminClient } from "./admin-client";
import {
  DISPUTE_EVIDENCE_UPDATE,
  DISPUTE_QUERY,
  DISPUTES_QUERY,
  ORDER_EVIDENCE_QUERY,
  SHOP_QUERY,
} from "./queries";
import {
  normalizeDispute,
  type RawDispute,
  type RawOrder,
  type RawShop,
} from "./normalize";
import type { RemoteDispute } from "../disputes/types";

const PAGE_SIZE = 50;
/** Hard stop so a misbehaving cursor can never loop forever. */
const MAX_PAGES = 40;

export async function fetchAllDisputes(
  admin: AdminClient,
  opts: { query?: string } = {},
): Promise<RemoteDispute[]> {
  const out: RemoteDispute[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: {
      disputes: {
        edges: Array<{ node: RawDispute }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await admin.graphql(DISPUTES_QUERY, {
      first: PAGE_SIZE,
      after,
      query: opts.query ?? null,
    });
    for (const edge of data.disputes.edges) out.push(normalizeDispute(edge.node));
    if (!data.disputes.pageInfo.hasNextPage || !data.disputes.pageInfo.endCursor) break;
    after = data.disputes.pageInfo.endCursor;
  }
  return out;
}

export async function fetchDispute(admin: AdminClient, id: string): Promise<RemoteDispute | null> {
  const data = await admin.graphql<{ dispute: RawDispute | null }>(DISPUTE_QUERY, { id });
  return data.dispute ? normalizeDispute(data.dispute) : null;
}

export async function fetchOrder(admin: AdminClient, id: string): Promise<RawOrder | null> {
  const data = await admin.graphql<{ order: RawOrder | null }>(ORDER_EVIDENCE_QUERY, { id });
  return data.order;
}

export async function fetchShop(admin: AdminClient): Promise<RawShop> {
  const data = await admin.graphql<{ shop: RawShop }>(SHOP_QUERY);
  return data.shop;
}

export interface EvidenceUpdateResult {
  submitted: boolean;
  errors: string[];
}

export async function updateDisputeEvidence(
  admin: AdminClient,
  evidenceId: string,
  input: Record<string, unknown>,
): Promise<EvidenceUpdateResult> {
  const data = await admin.graphql<{
    disputeEvidenceUpdate: {
      disputeEvidence: { id: string; submitted: boolean } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(DISPUTE_EVIDENCE_UPDATE, { id: evidenceId, input });
  const result = data.disputeEvidenceUpdate;
  return {
    submitted: Boolean(result.disputeEvidence?.submitted),
    errors: result.userErrors.map((e) =>
      e.field?.length ? `${e.field.join(".")}: ${e.message}` : e.message,
    ),
  };
}
