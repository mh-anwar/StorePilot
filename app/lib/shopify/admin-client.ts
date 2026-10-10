// The one seam between StorePilot and the Shopify Admin GraphQL API.
// Real requests go through the authenticated `admin` context from
// @shopify/shopify-app-react-router; the demo and tests use a mock that
// implements the same interface.

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export interface AdminClient {
  /** Runs a query or mutation and returns `data`. Throws AdminApiError on GraphQL errors. */
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
}

/** Minimal shape of the library's admin context we rely on. */
export interface GraphqlAdminLike {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export function fromShopifyAdmin(admin: GraphqlAdminLike): AdminClient {
  return {
    async graphql<T>(query: string, variables?: Record<string, unknown>) {
      const response = await admin.graphql(query, { variables });
      const body = (await response.json()) as { data?: T; errors?: unknown };
      if (body.errors) {
        throw new AdminApiError("Shopify Admin API returned errors", body.errors);
      }
      if (!body.data) throw new AdminApiError("Shopify Admin API returned no data");
      return body.data;
    },
  };
}
