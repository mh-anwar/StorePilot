"use client";

import { useState } from "react";

export function ConnectShopify() {
  const [shop, setShop] = useState("");
  const normalized = shop.trim().toLowerCase();
  const full = normalized.includes(".")
    ? normalized
    : normalized
      ? `${normalized}.myshopify.com`
      : "";
  const href = full ? `/api/shopify/auth?shop=${encodeURIComponent(full)}` : "#";

  return (
    <div className="border border-border rounded-xl p-5">
      <h2 className="font-semibold mb-1">Connect a store</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Enter your <code className="font-mono">.myshopify.com</code> domain. You&apos;ll
        be taken to Shopify to approve the install.
      </p>
      <div className="flex gap-2">
        <input
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="my-store"
          className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        />
        <span className="inline-flex items-center px-3 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground">
          .myshopify.com
        </span>
        <a
          href={href}
          className={`px-4 py-2 rounded-lg text-sm ${
            full
              ? "bg-violet-600 text-white"
              : "bg-muted text-muted-foreground pointer-events-none"
          }`}
        >
          Connect
        </a>
      </div>
    </div>
  );
}
