// Every GraphQL document StorePilot sends to the Admin API lives here, so the
// scope list in shopify.app.toml can be audited against one file.
//
// read_shopify_payments_disputes            -> DISPUTES_QUERY, DISPUTE_QUERY
// read_orders (+ read_customers)            -> ORDER_EVIDENCE_QUERY
// read_legal_policies                       -> SHOP_QUERY
// write_shopify_payments_dispute_evidences  -> DISPUTE_EVIDENCE_UPDATE

const DISPUTE_FIELDS = `#graphql
  fragment DisputeFields on ShopifyPaymentsDispute {
    id
    type
    status
    initiatedAt
    evidenceDueBy
    evidenceSentOn
    finalizedOn
    amount { amount currencyCode }
    reasonDetails { reason networkReasonCode }
    order { id name }
    disputeEvidence { id submitted }
  }
`;

export const DISPUTES_QUERY = `#graphql
  ${DISPUTE_FIELDS}
  query StorePilotDisputes($first: Int!, $after: String, $query: String) {
    disputes(first: $first, after: $after, query: $query, reverse: true) {
      edges { node { ...DisputeFields } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const DISPUTE_QUERY = `#graphql
  ${DISPUTE_FIELDS}
  query StorePilotDispute($id: ID!) {
    dispute(id: $id) { ...DisputeFields }
  }
`;

export const ORDER_EVIDENCE_QUERY = `#graphql
  query StorePilotOrderEvidence($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      sourceName
      tags
      clientIp
      totalPriceSet { shopMoney { amount currencyCode } }
      customer {
        id
        firstName
        lastName
        email
        createdAt
        numberOfOrders
        amountSpent { amount currencyCode }
      }
      billingAddress { name address1 address2 city province provinceCode zip country countryCodeV2 }
      shippingAddress { name address1 address2 city province provinceCode zip country countryCodeV2 }
      lineItems(first: 50) {
        nodes {
          title
          variantTitle
          sku
          quantity
          requiresShipping
          originalUnitPriceSet { shopMoney { amount } }
        }
      }
      transactions(first: 20) {
        kind
        status
        gateway
        paymentDetails {
          ... on CardPaymentDetails {
            company
            number
            avsResultCode
            cvvResultCode
          }
        }
      }
      fulfillments(first: 20) {
        status
        displayStatus
        createdAt
        deliveredAt
        trackingInfo(first: 5) { company number url }
      }
      refunds(first: 20) {
        createdAt
        note
        totalRefundedSet { shopMoney { amount } }
      }
    }
  }
`;

export const SHOP_QUERY = `#graphql
  query StorePilotShop {
    shop {
      name
      email
      currencyCode
      shopPolicies { type body }
    }
  }
`;

export const DISPUTE_EVIDENCE_UPDATE = `#graphql
  mutation StorePilotEvidenceUpdate($id: ID!, $input: ShopifyPaymentsDisputeEvidenceUpdateInput!) {
    disputeEvidenceUpdate(id: $id, input: $input) {
      disputeEvidence { id submitted }
      userErrors { field message }
    }
  }
`;
