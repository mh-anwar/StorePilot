interface ProductRef {
  id: number;
  name: string;
  price: string;
  category: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const statusDistribution = [
  { status: "delivered" as const, weight: 0.60 },
  { status: "shipped" as const, weight: 0.15 },
  { status: "confirmed" as const, weight: 0.10 },
  { status: "pending" as const, weight: 0.08 },
  { status: "cancelled" as const, weight: 0.05 },
  { status: "refunded" as const, weight: 0.02 },
];

function pickStatus(rand: () => number) {
  const r = rand();
  let cumulative = 0;
  for (const s of statusDistribution) {
    cumulative += s.weight;
    if (r < cumulative) return s.status;
  }
  return "delivered" as const;
}

export function generateOrders(
  productRefs: ProductRef[],
  customerCount: number,
  orderCount: number = 1200
) {
  const rand = seededRandom(123);
  const orders = [];
  const orderItems = [];

  const now = new Date("2026-04-10T00:00:00Z");
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Weight popular products higher
  const productWeights = productRefs.map((p) => {
    if (p.category === "Electronics" || p.category === "Apparel") return 2.0;
    if (p.category === "Beauty") return 1.5;
    return 1.0;
  });
  const totalWeight = productWeights.reduce((a, b) => a + b, 0);

  function pickProduct() {
    let r = rand() * totalWeight;
    for (let i = 0; i < productRefs.length; i++) {
      r -= productWeights[i];
      if (r <= 0) return productRefs[i];
    }
    return productRefs[productRefs.length - 1];
  }

  for (let i = 0; i < orderCount; i++) {
    const orderNumber = `SP-${String(10001 + i)}`;
    const customerId = Math.floor(rand() * customerCount) + 1;

    // Distribute orders over 90 days with weekend boost and a sale spike around day 45
    let dayOffset = Math.floor(rand() * 90);
    const dayOfWeek = new Date(
      ninetyDaysAgo.getTime() + dayOffset * 24 * 60 * 60 * 1000
    ).getDay();
    // Weekend boost
    if ((dayOfWeek === 0 || dayOfWeek === 6) && rand() < 0.3) {
      dayOffset = Math.min(dayOffset, 89);
    }
    // Sale spike around day 40-50
    if (dayOffset >= 40 && dayOffset <= 50 && rand() < 0.4) {
      dayOffset = 40 + Math.floor(rand() * 10);
    }

    const orderDate = new Date(
      ninetyDaysAgo.getTime() +
        dayOffset * 24 * 60 * 60 * 1000 +
        Math.floor(rand() * 24 * 60 * 60 * 1000)
    );

    const itemCount = Math.floor(rand() * 4) + 1;
    const items = [];
    const usedProducts = new Set<number>();
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      let product = pickProduct();
      while (usedProducts.has(product.id)) {
        product = pickProduct();
      }
      usedProducts.add(product.id);

      const quantity = Math.floor(rand() * 3) + 1;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;

      items.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
      });
    }

    const taxRate = 0.06 + rand() * 0.04;
    const tax = subtotal * taxRate;
    const shippingCost = subtotal > 100 ? 0 : 5.99 + rand() * 4;
    const discount =
      dayOffset >= 40 && dayOffset <= 50 ? subtotal * 0.15 : 0;
    const total = subtotal + tax + shippingCost - discount;
    const status = pickStatus(rand);

    orders.push({
      orderNumber,
      customerId,
      status,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2),
      currency: "USD",
      createdAt: orderDate,
      updatedAt: new Date(
        orderDate.getTime() + Math.floor(rand() * 3 * 24 * 60 * 60 * 1000)
      ),
    });

    for (const item of items) {
      orderItems.push({
        orderIndex: i,
        ...item,
      });
    }
  }

  return { orders, orderItems };
}
