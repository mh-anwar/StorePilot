// delay.sleep: pause the workflow for a set duration. Implemented
// synchronously here because workflow runs execute off-request inside
// the worker. For long delays (>1 min) we enqueue a future-dated job
// so we don't hold a worker slot; short delays run inline.
import { registerStep } from "../registry";
import { enqueue } from "@/lib/queue";

registerStep("delay.sleep", {
  category: "Logic",
  description: "Pause the workflow for N seconds (short) or schedule a resume (long).",
  handler: async (_step, cfg, ctx) => {
    const seconds = Number(cfg.seconds ?? 0);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return { status: "error", error: "seconds must be a non-negative number" };
    }
    if (seconds === 0) return { status: "ok", output: { slept: 0 } };
    if (seconds <= 30) {
      await new Promise((r) => setTimeout(r, seconds * 1000));
      return { status: "ok", output: { slept: seconds } };
    }
    // Long delay: schedule a resume and return ok so current run ends
    // cleanly. The re-runner will pick up at currentStep+1.
    await enqueue(
      "workflow.run" as never,
      { runId: ctx.runId },
      { runAt: new Date(Date.now() + seconds * 1000) }
    );
    return {
      status: "ok",
      output: { scheduledResumeIn: seconds, note: "run will resume via queue" },
    };
  },
});
