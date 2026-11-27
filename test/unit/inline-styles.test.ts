// React escapes quotes in <style> text during server rendering ("" becomes
// &quot;), but the browser doesn't decode entities inside <style>, so the
// client text differs and hydration fails for the whole page. Inline style
// blocks must stay free of quotes, apostrophes and ampersands.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

it("inline <style> blocks contain nothing React would escape", () => {
  const offenders: string[] = [];
  for (const file of files("app")) {
    const src = readFileSync(file, "utf8");
    let at = src.indexOf("<style>{`");
    while (at >= 0) {
      const end = src.indexOf("`}</style>", at);
      const css = src.slice(at + 9, end);
      if (/["'&<>]/.test(css)) offenders.push(file);
      at = src.indexOf("<style>{`", end);
    }
  }
  expect(offenders).toEqual([]);
});
