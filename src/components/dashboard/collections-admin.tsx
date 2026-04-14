"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Star } from "lucide-react";

type Coll = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  featured: boolean;
  sortOrder: number;
  productCount: number;
  createdAt: string;
};

export function CollectionsAdmin({
  initial,
  products,
}: {
  initial: Coll[];
  products: Array<{ id: number; name: string; slug: string }>;
}) {
  const [list, setList] = useState(initial);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  function create() {
    if (!name) return;
    start(async () => {
      const r = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc || null }),
      });
      if (r.ok) {
        const j = await r.json();
        setList((ls) => [{ ...j.collection, productCount: 0 }, ...ls]);
        setName("");
        setDesc("");
      }
    });
  }

  function remove(id: number) {
    start(async () => {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      setList((ls) => ls.filter((c) => c.id !== id));
    });
  }

  function toggleFeatured(id: number, v: boolean) {
    start(async () => {
      await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !v }),
      });
      setList((ls) => ls.map((c) => (c.id === id ? { ...c, featured: !v } : c)));
    });
  }

  async function openEditor(id: number) {
    setEditing(id);
    const r = await fetch(`/api/collections/${id}/products`);
    if (r.ok) {
      const j = await r.json();
      setPicked(j.productIds);
    }
  }

  function toggleProduct(pid: number) {
    setPicked((ps) =>
      ps.includes(pid) ? ps.filter((x) => x !== pid) : [...ps, pid]
    );
  }

  function saveProducts() {
    if (editing == null) return;
    start(async () => {
      await fetch(`/api/collections/${editing}/products`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: picked }),
      });
      setList((ls) =>
        ls.map((c) =>
          c.id === editing ? { ...c, productCount: picked.length } : c
        )
      );
      setEditing(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-border rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
          className="md:col-span-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="md:col-span-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        />
        <button
          disabled={pending}
          onClick={create}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((c) => (
          <div
            key={c.id}
            className="border border-border rounded-xl p-4 flex flex-col"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono">/{c.slug}</p>
              </div>
              <button
                onClick={() => toggleFeatured(c.id, c.featured)}
                className={`p-1.5 rounded hover:bg-muted ${
                  c.featured ? "text-yellow-400" : "text-muted-foreground"
                }`}
                title="Featured"
              >
                <Star className="h-4 w-4" fill={c.featured ? "currentColor" : "none"} />
              </button>
            </div>
            {c.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {c.description}
              </p>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              {c.productCount} products
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openEditor(c.id)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted"
              >
                Edit products
              </button>
              <button
                onClick={() => remove(c.id)}
                className="p-2 rounded-lg border border-border hover:bg-muted text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Pick products</h3>
              <button onClick={() => setEditing(null)} className="text-xs">
                Cancel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <button
              onClick={saveProducts}
              disabled={pending}
              className="mt-3 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
            >
              Save ({picked.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
