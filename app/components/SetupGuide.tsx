// First-run setup guide (Polaris "setup guide" pattern): a short checklist at
// the top of the home page until the merchant finishes it or hides it.

import { useFetcher } from "react-router";
import type { ActionResult } from "../lib/action-result";
import type { SetupGuide as Guide } from "../lib/onboarding";

export function SetupGuide({ guide }: { guide: Guide }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = (intent: string) => fetcher.state !== "idle" && fetcher.formData?.get("intent") === intent;
  const next = guide.steps.find((s) => !s.done);

  return (
    <s-section accessibilityLabel="Setup guide">
      <s-stack gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>Get ready for your next dispute</s-heading>
          <s-button
            variant="tertiary"
            loading={(busy("dismiss_setup")) || undefined}
            onClick={() => fetcher.submit({ intent: "dismiss_setup" }, { method: "post" })}
          >
            Hide guide
          </s-button>
        </s-stack>
        <s-paragraph color="subdued">
          {`${guide.completed} of ${guide.total} done. Most stores lose chargebacks because the evidence is scattered and the deadline slips by. These steps take about two minutes and make every response stronger.`}
        </s-paragraph>
        <s-stack gap="small-200">
          {guide.steps.map((step) => (
            <s-box
              key={step.id}
              padding="small-200"
              borderRadius="base"
              background={step.id === next?.id ? "subdued" : "transparent"}
            >
              <s-stack direction="inline" gap="small-200" alignItems="start">
                <s-icon
                  type={step.done ? "check-circle-filled" : "circle"}
                  tone={step.done ? "success" : "neutral"}
                />
                <s-stack gap="small-300">
                  <s-box accessibilityVisibility="exclusive">
                    <s-text>{step.done ? "Done:" : "To do:"}</s-text>
                  </s-box>
                  <s-text fontWeight={step.done ? "base" : "semibold"} color={step.done ? "subdued" : undefined}>
                    {step.title}
                  </s-text>
                  {step.id === next?.id ? (
                    <s-stack gap="small-200">
                      <s-paragraph color="subdued">{step.description}</s-paragraph>
                      <s-stack direction="inline">
                        {step.intent ? (
                          <s-button
                            variant="primary"
                            loading={(busy(step.intent)) || undefined}
                            onClick={() => fetcher.submit({ intent: step.intent! }, { method: "post" })}
                          >
                            {step.cta}
                          </s-button>
                        ) : (
                          <s-button variant="primary" href={step.href ?? undefined}>
                            {step.cta}
                          </s-button>
                        )}
                      </s-stack>
                    </s-stack>
                  ) : null}
                </s-stack>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-stack>
    </s-section>
  );
}
