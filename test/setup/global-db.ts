// Creates a fresh SQLite database for a test run from the real migrations.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

export default function setup({ provide }: { provide?: unknown } = {}) {
  void provide;
  const url = process.env.DATABASE_URL!;
  const file = path.join("prisma", url.replace(/^file:\.?\/?/, ""));
  for (const suffix of ["", "-journal"]) rmSync(file + suffix, { force: true });
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
