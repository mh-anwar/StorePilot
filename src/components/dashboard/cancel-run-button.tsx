"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";

export function CancelRunButton({ runId }: { runId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function cancel() {
    if (!confirm("Cancel this run? Pending proposals on it will be expired.")) return;
    start(async () => {
      const r = await fetch(`/api/workflow-runs/${runId}/cancel`, {
        method: "POST",
      });
      if (r.ok) router.refresh();
      else alert(((await r.json()).error as string) ?? "Failed to cancel");
    });
  }

  return (
    <button
      onClick={cancel}
      disabled={pending}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Ban className="h-3 w-3" />
      )}
      Cancel run
    </button>
  );
}
