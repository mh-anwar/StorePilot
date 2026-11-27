// React 18's server renderer writes boolean props on custom elements as
// strings, so <s-button loading={false}> arrives as loading="false". Polaris
// web components treat the attribute's presence as true, and once hydration
// succeeds React leaves the server attribute alone: buttons render stuck
// loading, checkboxes checked, fields disabled. Boolean props on s-* elements
// must pass `undefined` instead of `false`: `loading={cond || undefined}`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const BOOLEAN_PROP = /\b(loading|disabled|checked|required|readOnly)=\{([^{}]*)\}/g;

it("boolean props on Polaris web components never render as \"false\"", () => {
  const offenders: string[] = [];
  for (const file of files("app")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(BOOLEAN_PROP)) {
      const expr = m[2].trim();
      if (expr === "true" || expr.endsWith("|| undefined")) continue;
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(`${file}:${line} ${m[0]}`);
    }
  }
  expect(offenders).toEqual([]);
});
