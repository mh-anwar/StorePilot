// Shows the result of the last action as a Polaris banner.
import type { ActionResult } from "../lib/action-result";

export function Flash({ result, base }: { result: ActionResult | undefined | null; base?: string }) {
  if (!result) return null;
  if (!result.ok && result.code === "plan_limit" && base) {
    return (
      <s-banner tone="warning" heading="Monthly evidence packs used up" dismissible>
        <s-stack gap="small-200">
          <s-text>{result.error}</s-text>
          <s-stack direction="inline">
            <s-button href={`${base}/billing`} variant="primary">
              See plans
            </s-button>
          </s-stack>
        </s-stack>
      </s-banner>
    );
  }
  return result.ok ? (
    <s-banner tone="success" dismissible>
      {result.message}
    </s-banner>
  ) : (
    <s-banner tone="critical" heading="That didn't work" dismissible>
      {result.error}
    </s-banner>
  );
}
