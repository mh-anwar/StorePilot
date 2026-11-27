// First-run setup guide for the home page. Pure and client-safe: the loader
// passes in what it knows about the shop and this decides which steps are done.
//
// Every step is something that measurably improves the first dispute response:
// without a sync there is nothing to answer, without a support email or
// policies the evidence pack has gaps the bank will notice.

export type SetupStepId = "sync" | "contact" | "policies" | "plan";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  description: string;
  done: boolean;
  /** Where the step's button goes. `null` means the button posts an intent instead. */
  href: string | null;
  intent?: "sync";
  cta: string;
}

export interface SetupInput {
  lastSyncedAt: string | null;
  supportEmail: string | null;
  refundPolicy: string | null;
  shippingPolicy: string | null;
  plan: string;
  setupDismissedAt: string | null;
}

export interface SetupGuide {
  steps: SetupStep[];
  completed: number;
  total: number;
  /** Show the guide at all: not dismissed and something is left to do. */
  visible: boolean;
}

export function setupGuide(input: SetupInput, base: string): SetupGuide {
  const steps: SetupStep[] = [
    {
      id: "sync",
      title: "Import your disputes",
      description:
        "Pull every Shopify Payments dispute, open and closed, so deadlines and past losses show up here. New ones arrive automatically after that.",
      done: Boolean(input.lastSyncedAt),
      href: null,
      intent: "sync",
      cta: "Import disputes",
    },
    {
      id: "contact",
      title: "Add a customer support email",
      description:
        "Banks give more weight to merchants who were reachable. It goes into every rebuttal letter as the contact customers could have used.",
      done: Boolean(input.supportEmail?.trim()),
      href: `${base}/settings`,
      cta: "Add email",
    },
    {
      id: "policies",
      title: "Check your refund and shipping policies",
      description:
        "Policies are attached as evidence for “not as described” and “not received” claims. We load them from your store; make sure both are there.",
      done: Boolean(input.refundPolicy?.trim()) && Boolean(input.shippingPolicy?.trim()),
      href: `${base}/settings`,
      cta: "Review policies",
    },
    {
      id: "plan",
      title: "Pick a plan",
      description:
        "Free covers 3 evidence packs a month with template drafts. Growth and Pro add Claude-written rebuttals, and Pro drafts the moment a dispute arrives.",
      done: input.plan !== "free",
      href: `${base}/billing`,
      cta: "Compare plans",
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  // The plan step is optional: finishing the other three is "set up".
  const required = steps.filter((s) => s.id !== "plan");
  const requiredDone = required.every((s) => s.done);
  return {
    steps,
    completed,
    total: steps.length,
    visible: !input.setupDismissedAt && !requiredDone,
  };
}

// App Store reviews. We ask at the moment StorePilot has visibly paid for
// itself (a dispute won), never before, and at most once every 90 days.
// Shopify's own modal does the asking and applies its own rate limits; we never
// gate features on a review or offer anything for one.
export const REVIEW_INTERVAL_DAYS = 90;

export function shouldAskForReview(
  input: { won: number; reviewRequestedAt: string | null; isDemo: boolean },
  now = new Date(),
): boolean {
  if (input.isDemo || input.won < 1) return false;
  if (!input.reviewRequestedAt) return true;
  const since = (now.getTime() - new Date(input.reviewRequestedAt).getTime()) / 86_400_000;
  return since >= REVIEW_INTERVAL_DAYS;
}
