import { UTM_SOURCES, UTM_MEDIUMS } from "../constants";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface OrderRef {
  id: number;
  customerId: number;
  createdAt: Date;
  orderItems: Array<{ productId: number }>;
}

export function generateAnalyticsEvents(
  orderRefs: OrderRef[],
  productCount: number,
  customerCount: number
) {
  const rand = seededRandom(456);
  const events: Array<{
    eventType:
      | "page_view"
      | "product_view"
      | "add_to_cart"
      | "remove_from_cart"
      | "begin_checkout"
      | "purchase"
      | "search"
      | "refund";
    sessionId: string;
    customerId: number | null;
    productId: number | null;
    orderId: number | null;
    properties: Record<string, unknown>;
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    createdAt: Date;
  }> = [];

  const campaigns = [
    "spring_sale_2026",
    "new_arrivals_march",
    "flash_friday",
    "loyalty_rewards",
    "clearance_event",
    "influencer_collab",
  ];

  // Generate purchase funnels from existing orders
  for (const order of orderRefs) {
    const sessionId = `sess_${Math.floor(rand() * 1000000)
      .toString(36)
      .padStart(8, "0")}`;

    const source = UTM_SOURCES[Math.floor(rand() * UTM_SOURCES.length)];
    const medium = UTM_MEDIUMS[Math.floor(rand() * UTM_MEDIUMS.length)];
    const campaign =
      rand() < 0.4
        ? campaigns[Math.floor(rand() * campaigns.length)]
        : null;
    const referrer =
      source === "google"
        ? "https://www.google.com"
        : source === "facebook"
          ? "https://www.facebook.com"
          : source === "instagram"
            ? "https://www.instagram.com"
            : null;

    const baseTime = new Date(
      order.createdAt.getTime() - Math.floor(rand() * 30 * 60 * 1000)
    );

    // Page view
    events.push({
      eventType: "page_view",
      sessionId,
      customerId: order.customerId,
      productId: null,
      orderId: null,
      properties: { page: "/" },
      referrer,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
      createdAt: new Date(baseTime.getTime()),
    });

    // Product views for each item
    for (const item of order.orderItems) {
      events.push({
        eventType: "product_view",
        sessionId,
        customerId: order.customerId,
        productId: item.productId,
        orderId: null,
        properties: {},
        referrer,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: campaign,
        createdAt: new Date(
          baseTime.getTime() + Math.floor(rand() * 5 * 60 * 1000)
        ),
      });

      // Add to cart
      events.push({
        eventType: "add_to_cart",
        sessionId,
        customerId: order.customerId,
        productId: item.productId,
        orderId: null,
        properties: {},
        referrer: null,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: campaign,
        createdAt: new Date(
          baseTime.getTime() + Math.floor(rand() * 10 * 60 * 1000)
        ),
      });
    }

    // Begin checkout
    events.push({
      eventType: "begin_checkout",
      sessionId,
      customerId: order.customerId,
      productId: null,
      orderId: null,
      properties: { itemCount: order.orderItems.length },
      referrer: null,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
      createdAt: new Date(
        baseTime.getTime() + Math.floor(rand() * 15 * 60 * 1000)
      ),
    });

    // Purchase
    events.push({
      eventType: "purchase",
      sessionId,
      customerId: order.customerId,
      productId: null,
      orderId: order.id,
      properties: {},
      referrer: null,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
      createdAt: new Date(order.createdAt.getTime()),
    });
  }

  // Generate extra browse-only sessions (no purchase) — about 5x the purchase sessions
  const now = new Date("2026-04-10T00:00:00Z");
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < orderRefs.length * 4; i++) {
    const sessionId = `sess_b${Math.floor(rand() * 10000000)
      .toString(36)
      .padStart(8, "0")}`;
    const hasCustomer = rand() < 0.3;
    const customerId = hasCustomer
      ? Math.floor(rand() * customerCount) + 1
      : null;

    const source = UTM_SOURCES[Math.floor(rand() * UTM_SOURCES.length)];
    const medium = UTM_MEDIUMS[Math.floor(rand() * UTM_MEDIUMS.length)];
    const campaign =
      rand() < 0.3
        ? campaigns[Math.floor(rand() * campaigns.length)]
        : null;
    const referrer =
      source === "google"
        ? "https://www.google.com"
        : source === "facebook"
          ? "https://www.facebook.com"
          : null;

    const dayOffset = Math.floor(rand() * 90);
    const baseTime = new Date(
      ninetyDaysAgo.getTime() +
        dayOffset * 24 * 60 * 60 * 1000 +
        Math.floor(rand() * 24 * 60 * 60 * 1000)
    );

    // Page view
    events.push({
      eventType: "page_view",
      sessionId,
      customerId,
      productId: null,
      orderId: null,
      properties: { page: "/" },
      referrer,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
      createdAt: baseTime,
    });

    // Some browse products
    const browseCount = Math.floor(rand() * 4) + 1;
    for (let j = 0; j < browseCount; j++) {
      const productId = Math.floor(rand() * productCount) + 1;
      events.push({
        eventType: "product_view",
        sessionId,
        customerId,
        productId,
        orderId: null,
        properties: {},
        referrer: null,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: campaign,
        createdAt: new Date(
          baseTime.getTime() + (j + 1) * 60 * 1000 * (1 + rand() * 3)
        ),
      });

      // Some add to cart but abandon
      if (rand() < 0.3) {
        events.push({
          eventType: "add_to_cart",
          sessionId,
          customerId,
          productId,
          orderId: null,
          properties: {},
          referrer: null,
          utmSource: source,
          utmMedium: medium,
          utmCampaign: campaign,
          createdAt: new Date(
            baseTime.getTime() + (j + 2) * 60 * 1000 * (1 + rand() * 3)
          ),
        });
      }
    }

    // Some search events
    if (rand() < 0.2) {
      const searchTerms = [
        "cotton shirt",
        "headphones",
        "gift ideas",
        "yoga mat",
        "skincare",
        "wallet",
        "summer dress",
        "bluetooth speaker",
      ];
      events.push({
        eventType: "search",
        sessionId,
        customerId,
        productId: null,
        orderId: null,
        properties: {
          query: searchTerms[Math.floor(rand() * searchTerms.length)],
        },
        referrer: null,
        utmSource: source,
        utmMedium: medium,
        utmCampaign: campaign,
        createdAt: new Date(baseTime.getTime() + 30000),
      });
    }
  }

  return events;
}
