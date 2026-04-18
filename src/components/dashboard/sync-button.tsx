"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncButton({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function kick() {
    setMsg(null);
    start(async () => {
      const r = await fetch(`/api/shopify/shops/${shopId}/sync`, {
        method: "POST",
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Failed to enqueue sync");
        return;
      }
      setMsg(`Enqueued — ${j.enqueued} jobs. Tick the queue to run them.`);
      router.refresh();
    });
  }

  async function tick() {
    setMsg("Running queue…");
    const r = await fetch(`/api/jobs/tick`);
    const j = await r.json();
    setMsg(`Processed ${j.processed ?? 0} jobs.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={kick}
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enqueue full sync
      </button>
      <button
        onClick={tick}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
      >
        Tick queue
      </button>
      {msg && <p className="text-sm text-muted-foreground self-center">{msg}</p>}
    </div>
  );
}
