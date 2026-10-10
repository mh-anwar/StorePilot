// An in-memory Shopify Admin GraphQL API that answers the five operations in
// ../shopify/queries.ts. The demo store runs on it, and the tests use it both
// directly (as an AdminClient) and behind a fake `fetch` for the end-to-end
// install flow. It enforces the same rules Shopify does where they matter to
// us: unknown evidence ids and second submissions are rejected.

import { AdminApiError, type AdminClient } from "../shopify/admin-client";
import type { DisputeWebhookPayload, RawDispute, RawOrder, RawShop } from "../shopify/normalize";
import { demoDisputes, demoOrders, demoShop } from "./fixtures";

export interface MockAdminOptions {
  now?: Date;
  disputes?: RawDispute[];
  orders?: Record<string, RawOrder>;
  shop?: RawShop;
}

export interface StoredEvidence {
  input: Record<string, unknown>;
  submitted: boolean;
}

const clone = <T>(v: T): T => structuredClone(v);

export class MockShopifyAdmin implements AdminClient {
  readonly __storepilot = true;
  calls: Array<{ operation: string; variables: Record<string, unknown> }> = [];
  evidence = new Map<string, StoredEvidence>();
  private disputes: RawDispute[];
  private orders: Record<string, RawOrder>;
  private shop: RawShop;
  private now: () => Date;

  constructor(opts: MockAdminOptions = {}) {
    const now = opts.now;
    this.now = () => now ?? new Date();
    this.disputes = clone(opts.disputes ?? demoDisputes(now));
    this.orders = clone(opts.orders ?? demoOrders(now));
    this.shop = clone(opts.shop ?? demoShop());
    for (const d of this.disputes) {
      if (d.disputeEvidence) {
        this.evidence.set(d.disputeEvidence.id, { input: {}, submitted: Boolean(d.disputeEvidence.submitted) });
      }
    }
  }

  async graphql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "anonymous";
    this.calls.push({ operation, variables: clone(variables) });
    return this.execute(operation, variables) as T;
  }

  /** Same as graphql() but returns the full `{data}` / `{errors}` body, for the fake fetch. */
  async respond(query: string, variables: Record<string, unknown> = {}) {
    try {
      return { data: await this.graphql(query, variables) };
    } catch (error) {
      return { errors: [{ message: (error as Error).message }] };
    }
  }

  private execute(operation: string, v: Record<string, unknown>): unknown {
    switch (operation) {
      case "StorePilotDisputes": {
        const sorted = [...this.disputes].sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
        const first = Number(v.first ?? 50);
        const start = v.after ? Number(v.after) + 1 : 0;
        const page = sorted.slice(start, start + first);
        const end = start + page.length - 1;
        return {
          disputes: {
            edges: page.map((node, i) => ({ cursor: String(start + i), node: clone(node) })),
            pageInfo: { hasNextPage: end < sorted.length - 1, endCursor: page.length ? String(end) : null },
          },
        };
      }
      case "StorePilotDispute":
        return { dispute: clone(this.getDispute(String(v.id)) ?? null) };
      case "StorePilotOrderEvidence":
        return { order: clone(this.orders[String(v.id)] ?? null) };
      case "StorePilotShop":
        return { shop: clone(this.shop) };
      case "StorePilotEvidenceUpdate":
        return { disputeEvidenceUpdate: this.updateEvidence(String(v.id), (v.input ?? {}) as Record<string, unknown>) };
      default:
        throw new AdminApiError(`MockShopifyAdmin: unsupported operation ${operation}`);
    }
  }

  private updateEvidence(id: string, input: Record<string, unknown>) {
    const stored = this.evidence.get(id);
    const dispute = this.disputes.find((d) => d.disputeEvidence?.id === id);
    if (!stored || !dispute) {
      return { disputeEvidence: null, userErrors: [{ field: ["id"], message: "Dispute evidence not found" }] };
    }
    if (stored.submitted || dispute.evidenceSentOn) {
      return {
        disputeEvidence: { id, submitted: true },
        userErrors: [{ field: null, message: "Evidence has already been submitted" }],
      };
    }
    if (dispute.status !== "NEEDS_RESPONSE") {
      return { disputeEvidence: { id, submitted: false }, userErrors: [{ field: null, message: "Dispute is not open" }] };
    }
    const { submitEvidence, ...fields } = input;
    stored.input = { ...stored.input, ...clone(fields) };
    if (submitEvidence === true) {
      stored.submitted = true;
      dispute.evidenceSentOn = this.now().toISOString();
      dispute.status = "UNDER_REVIEW";
      if (dispute.disputeEvidence) dispute.disputeEvidence.submitted = true;
    }
    return { disputeEvidence: { id, submitted: stored.submitted }, userErrors: [] };
  }

  getDispute(id: string): RawDispute | undefined {
    return this.disputes.find((d) => d.id === id);
  }

  /** Simulates Shopify opening a new dispute. */
  addDispute(dispute: RawDispute, order: RawOrder) {
    this.disputes.push(clone(dispute));
    this.orders[order.id] = clone(order);
    if (dispute.disputeEvidence) this.evidence.set(dispute.disputeEvidence.id, { input: {}, submitted: false });
  }

  /** Simulates the bank's decision. */
  setStatus(id: string, status: string, finalizedOn: string | null = this.now().toISOString()) {
    const d = this.getDispute(id);
    if (!d) throw new Error(`no dispute ${id}`);
    d.status = status;
    if (["WON", "LOST", "ACCEPTED", "CHARGE_REFUNDED"].includes(status)) d.finalizedOn = finalizedOn;
  }

  setShop(shop: RawShop) {
    this.shop = clone(shop);
  }
}

/** The REST-shaped body Shopify posts for disputes/create and disputes/update. */
export function webhookPayloadFor(d: RawDispute): DisputeWebhookPayload {
  const numericId = d.id.split("/").pop()!;
  return {
    id: Number(numericId),
    admin_graphql_api_id: d.id,
    order_id: d.order ? Number(d.order.id.split("/").pop()) : null,
    type: d.type.toLowerCase(),
    amount: d.amount.amount,
    currency: d.amount.currencyCode,
    reason: d.reasonDetails.reason.toLowerCase(),
    network_reason_code: d.reasonDetails.networkReasonCode ?? null,
    status: d.status.toLowerCase(),
    evidence_due_by: d.evidenceDueBy ?? null,
    evidence_sent_on: d.evidenceSentOn ?? null,
    finalized_on: d.finalizedOn ?? null,
    initiated_at: d.initiatedAt,
  };
}
