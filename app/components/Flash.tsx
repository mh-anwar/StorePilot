// Shows the result of the last action as a Polaris banner.
import type { ActionResult } from "../lib/action-result";

export function Flash({ result }: { result: ActionResult | undefined | null }) {
  if (!result) return null;
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
