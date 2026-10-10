// Drives the public demo in headless Chrome: checks the merchant flow works in
// a real browser (Polaris web components, fetchers, the submit confirmation)
// and saves the README screenshots to docs/screenshots/.
//
//   pnpm build && PORT=3457 pnpm start &      # or any running server
//   BASE_URL=http://127.0.0.1:3457 pnpm walkthrough
//
// CHROME_PATH overrides the browser (defaults to /usr/bin/google-chrome).

import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3457";
const OUT = "docs/screenshots";
const SHOTS = process.env.SCREENSHOTS !== "off";

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(`walkthrough: ${message}`);
  console.log(`  ok  ${message}`);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Polaris web components upgrade after the script loads.
  await page.waitForFunction(() => customElements.get("s-page") !== undefined, null, { timeout: 15_000 });
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string, fullPage = false) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`  ->  ${OUT}/${name}.png`);
}

async function openDispute(page: Page, orderName: string) {
  await page.goto(`${BASE}/demo?tab=all`);
  await settle(page);
  await page.getByRole("link", { name: orderName, exact: true }).click();
  await page.waitForURL(/\/demo\/disputes\//);
  await settle(page);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });

    // Fresh demo store.
    await page.goto(`${BASE}/demo`);
    await settle(page);
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL(`${BASE}/demo`);
    await settle(page);
    check(await page.getByText("Needs response").filter({ visible: true }).first().isVisible(), "inbox renders");
    check((await page.locator("s-table-row").count()) === 8, "eight disputes need a response");
    await shot(page, "inbox");

    // A pack with a draft already written.
    await openDispute(page, "#1044");
    check(await page.getByText("What the bank will look for").filter({ visible: true }).first().isVisible(), "evidence checklist shows");
    await shot(page, "dispute");

    // The weak one: StorePilot says don't bother.
    await openDispute(page, "#1047");
    check(await page.getByText("Evidence is thin").filter({ visible: true }).first().isVisible(), "weak case recommends accepting");
    await shot(page, "accept-recommendation");

    // Full loop on #1041: draft, edit, save, submit.
    await openDispute(page, "#1041");
    await page.getByRole("button", { name: "Draft the response" }).click();
    const letter = page.getByLabel("Rebuttal letter");
    await letter.waitFor({ timeout: 15_000 });
    check((await letter.inputValue()).includes("#1041"), "template draft names the order");

    await letter.press("End");
    await letter.pressSequentially("\nThe customer emailed on the delivery date to say the pack arrived.", { delay: 2 });
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(/Saved as v2/).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
    check(true, "edit saved as version 2");

    await page.getByRole("button", { name: "Submit to the bank…" }).click();
    await page.getByText("Submit this response to the bank?").filter({ visible: true }).first().waitFor();
    // Frame the letter and the warning together.
    await page.getByRole("button", { name: "Cancel" }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await shot(page, "submit-confirm");
    await page.getByRole("button", { name: "Submit to the bank", exact: true }).click();
    await page.getByText(/submitted\. The bank usually decides/).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
    await page.reload();
    await settle(page);
    check(await page.getByText("Evidence submitted").filter({ visible: true }).first().isVisible(), "dispute shows as submitted");
    const submittedLetter = await page.getByLabel("Rebuttal letter").inputValue();
    check(submittedLetter.includes("arrived."), "the edited letter is what was submitted");

    // The bank decides; the inbox shows the win.
    await page.goto(`${BASE}/demo`);
    await settle(page);
    await page.getByRole("button", { name: "Simulate bank decisions" }).click();
    await page.waitForURL(/tab=closed/);
    await settle(page);
    check((await page.locator("s-table-row").count()) === 3, "closed tab now holds three disputes");

    await page.goto(`${BASE}/demo/billing`);
    await settle(page);
    check(await page.getByText("$79 / month").filter({ visible: true }).first().isVisible(), "plans page lists Pro");
    await shot(page, "plans");

    await page.goto(`${BASE}/demo/settings`);
    await settle(page);
    await shot(page, "settings");

    // Leave the demo tidy for the next visitor.
    await page.goto(`${BASE}/demo`);
    await settle(page);
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL(`${BASE}/demo`);
    console.log("walkthrough passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
