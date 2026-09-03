// A believable small store with a month of disputes, in the exact shapes the
// Admin GraphQL API returns. Dates are relative to `now` so the demo always
// has deadlines coming up. All people, emails and IPs are fictional
// (example.com, RFC 5737 documentation ranges).

import type { RawDispute, RawOrder, RawShop } from "../shopify/normalize";

export const DEMO_SHOP_DOMAIN = "storepilot-demo.myshopify.com";

export function demoShop(): RawShop {
  return {
    name: "Juniper Trail Outfitters",
    email: "help@junipertrail.example.com",
    currencyCode: "USD",
    shopPolicies: [
      {
        type: "REFUND_POLICY",
        body:
          "We accept returns of unused gear within 30 days of delivery. Start a return from your order page or email help@junipertrail.example.com; refunds go back to the original payment method within 5 business days of the return arriving. Items that show trail use, and opened food or coffee, can't be returned.",
      },
      {
        type: "SHIPPING_POLICY",
        body:
          "Orders ship from Bend, Oregon within one business day with tracked UPS or USPS delivery. Tracking is emailed when the label is created. Packages marked delivered by the carrier are the customer's responsibility; contact us within 7 days if something seems wrong and we'll open a carrier claim.",
      },
      {
        type: "TERMS_OF_SERVICE",
        body:
          "Trail Coffee subscriptions renew monthly on the date of the first order. You can skip or cancel any time from your account page up to 3 days before the next renewal; renewals already processed can't be refunded once roasted and shipped. By checking out you agree to these terms.",
      },
    ],
  };
}

const day = 86_400_000;
const iso = (now: Date, days: number, hour = 15) => {
  const d = new Date(now.getTime() + days * day);
  d.setUTCHours(hour, 12, 0, 0);
  return d.toISOString();
};

interface Person {
  first: string;
  last: string;
  email: string;
  orders: number;
  spent: string;
  since: number; // days before now
  address: { address1: string; city: string; province: string; provinceCode: string; zip: string };
}

const PEOPLE: Record<string, Person> = {
  maya: { first: "Maya", last: "Okafor", email: "maya.okafor@example.com", orders: 5, spent: "1124.00", since: 410,
    address: { address1: "2214 NE Alberta St", city: "Portland", province: "Oregon", provinceCode: "OR", zip: "97211" } },
  dev: { first: "Devon", last: "Hale", email: "devon.hale@example.com", orders: 7, spent: "1890.50", since: 720,
    address: { address1: "88 Larkspur Ln", city: "Boulder", province: "Colorado", provinceCode: "CO", zip: "80302" } },
  kim: { first: "Jordan", last: "Kim", email: "j.kim.trails@example.com", orders: 1, spent: "38.00", since: 9,
    address: { address1: "4410 Grand Ave", city: "Chicago", province: "Illinois", provinceCode: "IL", zip: "60651" } },
  ana: { first: "Ana", last: "Ruiz", email: "ana.ruiz@example.com", orders: 2, spent: "512.00", since: 95,
    address: { address1: "19 Calle Del Sol", city: "Santa Fe", province: "New Mexico", provinceCode: "NM", zip: "87501" } },
  sam: { first: "Sam", last: "Whitaker", email: "sam.whitaker@example.com", orders: 3, spent: "219.00", since: 160,
    address: { address1: "702 Pine St", city: "Missoula", province: "Montana", provinceCode: "MT", zip: "59801" } },
  lee: { first: "Riley", last: "Lee", email: "riley.lee@example.com", orders: 9, spent: "468.00", since: 300,
    address: { address1: "51 Harbor View Rd", city: "Burlington", province: "Vermont", provinceCode: "VT", zip: "05401" } },
  noor: { first: "Noor", last: "Haddad", email: "noor.haddad@example.com", orders: 4, spent: "702.00", since: 250,
    address: { address1: "1300 S Lamar Blvd", city: "Austin", province: "Texas", provinceCode: "TX", zip: "78704" } },
  eli: { first: "Eli", last: "Turner", email: "eli.turner@example.com", orders: 2, spent: "389.00", since: 140,
    address: { address1: "9 Orchard Way", city: "Asheville", province: "North Carolina", provinceCode: "NC", zip: "28801" } },
  pat: { first: "Pat", last: "Moreno", email: "pat.moreno@example.com", orders: 6, spent: "980.00", since: 500,
    address: { address1: "300 Cascade Ave", city: "Hood River", province: "Oregon", provinceCode: "OR", zip: "97031" } },
  quinn: { first: "Quinn", last: "Baptiste", email: "quinn.b@example.com", orders: 2, spent: "142.00", since: 60,
    address: { address1: "77 Mill Rd", city: "Duluth", province: "Minnesota", provinceCode: "MN", zip: "55802" } },
};

interface OrderSpec {
  n: number; // order number and id suffix
  person: keyof typeof PEOPLE;
  placed: number; // days relative to now
  items: Array<{ title: string; variant?: string; sku: string; price: string; qty?: number; ship?: boolean }>;
  avs: string | null;
  cvv: string | null;
  card?: string;
  ip: string;
  shipTo?: Partial<Person["address"]> & { name?: string };
  fulfillment?: { shipped: number; delivered?: number | null; carrier: string; number: string; status?: string };
  refund?: { at: number; amount: string; note: string };
  tags?: string[];
}

function order(now: Date, s: OrderSpec): RawOrder {
  const p = PEOPLE[s.person];
  const total = s.items.reduce((sum, i) => sum + Number(i.price) * (i.qty ?? 1), 0).toFixed(2);
  const billing = { name: `${p.first} ${p.last}`, ...p.address, address2: null, country: "United States", countryCodeV2: "US" };
  const shipping = s.shipTo ? { ...billing, ...s.shipTo } : billing;
  const trackingUrl = (carrier: string, n: string) =>
    carrier === "UPS" ? `https://www.ups.com/track?tracknum=${n}` : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  return {
    id: `gid://shopify/Order/${5100 + s.n}`,
    name: `#${1000 + s.n}`,
    createdAt: iso(now, s.placed, 18),
    sourceName: "web",
    tags: s.tags ?? [],
    clientIp: s.ip,
    totalPriceSet: { shopMoney: { amount: total, currencyCode: "USD" } },
    customer: {
      id: `gid://shopify/Customer/${7700 + s.n}`,
      firstName: p.first,
      lastName: p.last,
      email: p.email,
      createdAt: iso(now, -p.since, 12),
      numberOfOrders: String(p.orders),
      amountSpent: { amount: p.spent, currencyCode: "USD" },
    },
    billingAddress: billing,
    shippingAddress: shipping,
    lineItems: {
      nodes: s.items.map((i) => ({
        title: i.title,
        variantTitle: i.variant ?? null,
        sku: i.sku,
        quantity: i.qty ?? 1,
        requiresShipping: i.ship ?? true,
        originalUnitPriceSet: { shopMoney: { amount: i.price } },
      })),
    },
    transactions: [
      {
        kind: "SALE",
        status: "SUCCESS",
        gateway: "shopify_payments",
        paymentDetails: {
          company: s.card ?? "Visa",
          number: "•••• •••• •••• " + String(4000 + s.n * 37).slice(-4),
          avsResultCode: s.avs,
          cvvResultCode: s.cvv,
        },
      },
    ],
    fulfillments: s.fulfillment
      ? [
          {
            status: "SUCCESS",
            displayStatus: s.fulfillment.status ?? (s.fulfillment.delivered != null ? "DELIVERED" : "IN_TRANSIT"),
            createdAt: iso(now, s.fulfillment.shipped, 21),
            deliveredAt: s.fulfillment.delivered != null ? iso(now, s.fulfillment.delivered, 17) : null,
            trackingInfo: s.fulfillment.number
              ? [
                  {
                    company: s.fulfillment.carrier,
                    number: s.fulfillment.number,
                    url: trackingUrl(s.fulfillment.carrier, s.fulfillment.number),
                  },
                ]
              : [],
          },
        ]
      : [],
    refunds: s.refund
      ? [{ createdAt: iso(now, s.refund.at), note: s.refund.note, totalRefundedSet: { shopMoney: { amount: s.refund.amount } } }]
      : [],
  };
}

const SPECS: OrderSpec[] = [
  { n: 41, person: "maya", placed: -26, avs: "Y", cvv: "M", ip: "198.51.100.23",
    items: [{ title: "Ridgeline 45L Pack", variant: "Moss", sku: "RL45-MOS", price: "229.00" }, { title: "Merino Base Layer", variant: "Women's M", sku: "MBL-WM", price: "89.00" }],
    fulfillment: { shipped: -25, delivered: -21, carrier: "UPS", number: "1Z84A9E70392114586" } },
  { n: 44, person: "dev", placed: -19, avs: "Y", cvv: "M", ip: "192.0.2.144",
    items: [{ title: "Ultralight Tent 2P", sku: "ULT-2P", price: "449.00" }, { title: "Footprint for Ultralight 2P", sku: "ULT-2P-FP", price: "59.00" }],
    fulfillment: { shipped: -18, delivered: -15, carrier: "UPS", number: "1Z84A9E70392209431" } },
  { n: 47, person: "kim", placed: -9, avs: "N", cvv: "N", ip: "203.0.113.77", card: "Mastercard",
    items: [{ title: "Insulated Camp Mug", variant: "Slate", sku: "MUG-SLT", price: "38.00" }],
    shipTo: { name: "J Kim", address1: "1201 Commerce Dr Unit 14", city: "Miami", province: "Florida", provinceCode: "FL", zip: "33166" },
    fulfillment: { shipped: -8, delivered: null, carrier: "USPS", number: "9400111899223197451210", status: "IN_TRANSIT" } },
  { n: 38, person: "ana", placed: -31, avs: "Y", cvv: "M", ip: "198.51.100.61",
    items: [{ title: "Granite Rain Shell", variant: "Women's S / Ember", sku: "GRS-WS-EMB", price: "264.00" }],
    // Shipped with an untracked label: the case rests on the product and the refund policy.
    fulfillment: { shipped: -30, delivered: null, carrier: "USPS", number: "", status: "FULFILLED" } },
  { n: 35, person: "sam", placed: -34, avs: "Y", cvv: "M", ip: "192.0.2.18",
    items: [{ title: "Trekking Poles (pair)", sku: "TP-AL", price: "119.00" }],
    fulfillment: { shipped: -33, delivered: -29, carrier: "USPS", number: "9400111899223196602177" },
    refund: { at: -20, amount: "119.00", note: "Returned unused; refunded to card." } },
  { n: 39, person: "lee", placed: -12, avs: "Y", cvv: "M", ip: "198.51.100.9",
    items: [{ title: "Trail Coffee Subscription", variant: "Monthly / Whole bean", sku: "TCS-WB", price: "26.00", ship: true }],
    fulfillment: { shipped: -11, delivered: -8, carrier: "USPS", number: "9400111899223197013345" }, tags: ["subscription"] },
  { n: 43, person: "noor", placed: -16, avs: "Y", cvv: "M", ip: "192.0.2.201",
    items: [{ title: "Packable Down Jacket", variant: "Men's L / Black", sku: "PDJ-ML-BLK", price: "189.00" }],
    fulfillment: { shipped: -15, delivered: -12, carrier: "UPS", number: "1Z84A9E70392180955" } },
  { n: 22, person: "eli", placed: -96, avs: "Y", cvv: "M", ip: "198.51.100.140",
    items: [{ title: "Ridgeline 45L Pack", variant: "Rust", sku: "RL45-RST", price: "229.00" }, { title: "Rain Cover 45L", sku: "RC-45", price: "35.00" }],
    fulfillment: { shipped: -95, delivered: -91, carrier: "UPS", number: "1Z84A9E70389915520" } },
  { n: 19, person: "quinn", placed: -104, avs: "A", cvv: "M", ip: "203.0.113.5",
    items: [{ title: "Merino Base Layer", variant: "Men's M", sku: "MBL-MM", price: "89.00" }, { title: "Wool Hiking Socks (3-pack)", sku: "WHS-3", price: "53.00" }],
    shipTo: { name: "Quinn Baptiste", address1: "15 Lakeview Ter", city: "Superior", province: "Wisconsin", provinceCode: "WI", zip: "54880" },
    fulfillment: { shipped: -103, delivered: null, carrier: "USPS", number: "9400111899223188801236", status: "IN_TRANSIT" } },
  { n: 46, person: "pat", placed: -6, avs: "Y", cvv: "M", ip: "192.0.2.90",
    items: [{ title: "Ultralight Tent 2P", sku: "ULT-2P", price: "449.00" }, { title: "Camp Stove Kit", sku: "CSK-1", price: "129.00" }, { title: "Insulated Camp Mug", variant: "Moss", sku: "MUG-MOS", price: "38.00" }, { title: "Headlamp 400", sku: "HL-400", price: "24.00" }],
    fulfillment: { shipped: -5, delivered: -2, carrier: "UPS", number: "1Z84A9E70392330817" } },
];

interface DisputeSpec {
  n: number; // dispute id suffix
  order: number;
  type?: "CHARGEBACK" | "INQUIRY";
  status: string;
  reason: string;
  code: string;
  amount?: string; // defaults to order total
  opened: number;
  due: number | null;
  sent?: number;
  finalized?: number;
}

const DISPUTES: DisputeSpec[] = [
  { n: 901, order: 41, status: "NEEDS_RESPONSE", reason: "PRODUCT_NOT_RECEIVED", code: "13.1", opened: -3, due: 12 },
  { n: 902, order: 44, status: "NEEDS_RESPONSE", reason: "FRAUDULENT", code: "10.4", opened: -5, due: 2 },
  { n: 903, order: 47, status: "NEEDS_RESPONSE", reason: "FRAUDULENT", code: "4837", opened: -2, due: 16 },
  { n: 904, order: 38, status: "NEEDS_RESPONSE", reason: "PRODUCT_UNACCEPTABLE", code: "13.3", opened: -6, due: 9 },
  { n: 905, order: 35, status: "NEEDS_RESPONSE", reason: "CREDIT_NOT_PROCESSED", code: "13.6", opened: -4, due: 14 },
  { n: 906, order: 39, status: "NEEDS_RESPONSE", reason: "SUBSCRIPTION_CANCELLED", code: "13.2", opened: -2, due: 18 },
  { n: 907, order: 43, type: "INQUIRY", status: "NEEDS_RESPONSE", reason: "UNRECOGNIZED", code: "4863", opened: -1, due: 6 },
  { n: 908, order: 46, status: "NEEDS_RESPONSE", reason: "DUPLICATE", code: "12.6.1", amount: "640.00", opened: -1, due: 1 },
  { n: 880, order: 22, status: "WON", reason: "PRODUCT_NOT_RECEIVED", code: "13.1", opened: -70, due: null, sent: -62, finalized: -18 },
  { n: 876, order: 19, status: "LOST", reason: "FRAUDULENT", code: "4837", opened: -80, due: null, sent: -73, finalized: -25 },
];

export function demoOrders(now = new Date()): Record<string, RawOrder> {
  const out: Record<string, RawOrder> = {};
  for (const spec of SPECS) {
    const o = order(now, spec);
    out[o.id] = o;
  }
  return out;
}

export function demoDisputes(now = new Date()): RawDispute[] {
  const orders = demoOrders(now);
  return DISPUTES.map((d) => {
    const o = orders[`gid://shopify/Order/${5100 + d.order}`];
    return {
      id: `gid://shopify/ShopifyPaymentsDispute/${d.n}`,
      type: d.type ?? "CHARGEBACK",
      status: d.status,
      initiatedAt: iso(now, d.opened, 9),
      evidenceDueBy: d.due === null ? null : iso(now, d.due, 23),
      evidenceSentOn: d.sent === undefined ? null : iso(now, d.sent, 16),
      finalizedOn: d.finalized === undefined ? null : iso(now, d.finalized, 10),
      amount: { amount: d.amount ?? o.totalPriceSet.shopMoney.amount, currencyCode: "USD" },
      reasonDetails: { reason: d.reason, networkReasonCode: d.code },
      order: { id: o.id, name: o.name },
      disputeEvidence: { id: `gid://shopify/ShopifyPaymentsDisputeEvidence/${d.n}`, submitted: d.sent !== undefined },
    };
  });
}

/** A dispute that "arrives" when the demo visitor clicks "Simulate a new dispute". */
export function incomingDemoDispute(now = new Date(), seq = 1): { dispute: RawDispute; order: RawOrder } {
  const n = 950 + seq;
  const o = order(now, {
    n: 60 + seq, person: "maya", placed: -14, avs: "Y", cvv: "M", ip: "198.51.100.23",
    items: [{ title: "Packable Down Jacket", variant: "Women's M / Sage", sku: "PDJ-WM-SGE", price: "189.00" }],
    fulfillment: { shipped: -13, delivered: -10, carrier: "UPS", number: `1Z84A9E7039240${String(1000 + seq).slice(-4)}` },
  });
  return {
    order: o,
    dispute: {
      id: `gid://shopify/ShopifyPaymentsDispute/${n}`,
      type: "CHARGEBACK",
      status: "NEEDS_RESPONSE",
      initiatedAt: now.toISOString(),
      evidenceDueBy: iso(now, 15, 23),
      evidenceSentOn: null,
      finalizedOn: null,
      amount: { amount: "189.00", currencyCode: "USD" },
      reasonDetails: { reason: "PRODUCT_NOT_RECEIVED", networkReasonCode: "13.1" },
      order: { id: o.id, name: o.name },
      disputeEvidence: { id: `gid://shopify/ShopifyPaymentsDisputeEvidence/${n}`, submitted: false },
    },
  };
}
