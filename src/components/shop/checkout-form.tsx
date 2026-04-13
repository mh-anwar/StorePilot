"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CartSummary } from "@/lib/cart";
import { Loader2 } from "lucide-react";

export function CheckoutForm({ cart }: { cart: CartSummary }) {
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setErr(null);
    if (!email || !first || !last || !line1 || !city || !state || !zip) {
      setErr("Please fill in all required fields.");
      return;
    }
    start(async () => {
      const r = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: first,
          lastName: last,
          shippingAddress: { line1, line2, city, state, zip, country },
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Checkout failed");
        return;
      }
      router.push(`/shop/order/${j.orderNumber}`);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold mb-3">Contact</h2>
        <Field label="Email" value={email} set={setEmail} type="email" required />
      </div>
      <div>
        <h2 className="font-semibold mb-3">Shipping address</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={first} set={setFirst} required />
          <Field label="Last name" value={last} set={setLast} required />
        </div>
        <Field label="Address line 1" value={line1} set={setLine1} required />
        <Field label="Address line 2 (optional)" value={line2} set={setLine2} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={city} set={setCity} required />
          <Field label="State / Province" value={state} set={setState} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ZIP / Postal" value={zip} set={setZip} required />
          <Field label="Country" value={country} set={setCountry} required />
        </div>
      </div>
      <div>
        <h2 className="font-semibold mb-3">Payment</h2>
        <div className="p-4 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
          Demo checkout — no real payment is taken. Your order will be created
          immediately with status <code>confirmed</code>.
        </div>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Place order — ${cart.total.toFixed(2)}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  set,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
      />
    </div>
  );
}
