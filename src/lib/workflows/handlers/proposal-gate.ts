// proposal.gate: drops a proposed action into the approval queue and
// suspends the run. The approver sees the resolved action_config and can
// approve/reject from the Proposals inbox. On approve the run resumes.
import { registerStep } from "../registry";

registerStep("proposal.gate", {
  category: "Approvals",
  description:
    "Stops the workflow and creates a proposal for a human to approve. The action, its config, and the reasoning trail are all shown in the Proposals inbox.",
  handler: async (_step, cfg, ctx) => {
    const actionType = String(cfg.actionType ?? "");
    if (!actionType) {
      return { status: "error", error: "proposal.gate requires 'actionType'" };
    }
    return {
      status: "awaiting_approval",
      proposal: {
        actionType,
        actionConfig: (cfg.actionConfig as Record<string, unknown>) ?? {},
        summary: (cfg.summary as string) ?? `${actionType} proposed by workflow`,
        rationale:
          (cfg.rationale as string) ??
          (ctx.steps[Object.keys(ctx.steps).pop() ?? ""]?.output as unknown as { rationale?: string })?.rationale ??
          undefined,
      },
    };
  },
});
