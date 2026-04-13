"use client";

import { useState, useTransition } from "react";
import type { reviews as reviewsSchema } from "@/lib/db/schema";
import { useRouter } from "next/navigation";

type Review = typeof reviewsSchema.$inferSelect;

export function ReviewsSection({
  productId,
  reviews,
}: {
  productId: number;
  reviews: Review[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!name || !body) {
      setErr("Name and review are required");
      return;
    }
    setErr(null);
    start(async () => {
      const r = await fetch("/api/shop/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, authorName: name, rating, title, body }),
      });
      if (r.ok) {
        setShowForm(false);
        setName("");
        setTitle("");
        setBody("");
        router.refresh();
      } else {
        setErr("Could not submit");
      }
    });
  }

  return (
    <section className="mt-16 border-t border-border pt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Customer reviews</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
        >
          {showForm ? "Cancel" : "Write a review"}
        </button>
      </div>
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-xl space-y-3">
          <div className="flex gap-3 flex-wrap">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm min-w-48"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  className={`text-2xl ${
                    s <= rating ? "text-yellow-400" : "text-muted-foreground"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Review title (optional)"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What did you think?"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            onClick={submit}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit review"}
          </button>
        </div>
      )}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{r.authorName}</p>
                <p className="text-xs text-yellow-400">
                  {"★".repeat(r.rating)}
                  <span className="text-muted-foreground">
                    {"★".repeat(5 - r.rating)}
                  </span>
                </p>
              </div>
              {r.title && <p className="font-medium text-sm mt-1">{r.title}</p>}
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                {r.body}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
