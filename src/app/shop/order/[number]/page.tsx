import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { orders, orderItems, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, number));
  if (!order) notFound();
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const [c] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId));

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Thank you{c ? `, ${c.firstName}` : ""}!</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your order <span className="font-mono">{order.orderNumber}</span> is confirmed.
        </p>
      </div>
      <div className="border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Items</h2>
        <div className="space-y-2 text-sm">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span className="text-muted-foreground">
                {it.productName} × {it.quantity}
              </span>
              <span>${parseFloat(it.totalPrice).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 mt-3 space-y-1 text-sm">
          <Row label="Subtotal" value={`$${parseFloat(order.subtotal).toFixed(2)}`} />
          {parseFloat(order.discount || "0") > 0 && (
            <Row
              label="Discount"
              value={`-$${parseFloat(order.discount || "0").toFixed(2)}`}
            />
          )}
          <Row
            label="Shipping"
            value={`$${parseFloat(order.shippingCost || "0").toFixed(2)}`}
          />
          <Row label="Tax" value={`$${parseFloat(order.tax).toFixed(2)}`} />
          <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>${parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/shop"
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
