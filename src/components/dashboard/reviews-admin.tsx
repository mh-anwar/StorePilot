"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X, Trash2 } from "lucide-react";

type Row = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  productName: string;
  productSlug: string;
  productId: number;
};

export function ReviewsAdmin({ initial }: { initial: Row[] }) {
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [pending, start] = useTransition();

  const filtered = list.filter((r) => filter === "all" || r.status === filter);

  function updateStatus(id: number, status: "approved" | "rejected") {
    start(async () => {
      await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setList((ls) => ls.map((r) => (r.id === id ? { ...r, status } : r)));
    });
  }

  function remove(id: number) {
    start(async () => {
      await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      setList((ls) => ls.filter((r) => r.id !== id));
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg border ${
              filter === f
                ? "bg-violet-600 text-white border-violet-600"
                : "border-border hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="border border-border rounded-xl p-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-400">
                    {"★".repeat(r.rating)}
                    <span className="text-muted-foreground">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">· {r.authorName}</span>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    href={`/shop/${r.productSlug}`}
                    className="text-muted-foreground hover:text-foreground truncate"
                  >
                    {r.productName}
                  </Link>
                </div>
                {r.title && <p className="font-medium mt-1">{r.title}</p>}
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                  {r.body}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    r.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : r.status === "rejected"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {r.status}
                </span>
                {r.status !== "approved" && (
                  <button
                    onClick={() => updateStatus(r.id, "approved")}
                    disabled={pending}
                    className="p-2 rounded hover:bg-muted text-emerald-400"
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    onClick={() => updateStatus(r.id, "rejected")}
                    disabled={pending}
                    className="p-2 rounded hover:bg-muted text-amber-400"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => remove(r.id)}
                  className="p-2 rounded hover:bg-muted text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No reviews.
          </div>
        )}
      </div>
    </div>
  );
}
