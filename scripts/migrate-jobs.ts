import { readFileSync } from "fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}
import { neon } from "@neondatabase/serverless";

const SQL = `
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('pending','running','succeeded','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_runat ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_kind ON jobs(kind);
`;

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  for (const s of SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    try {
      await sql.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 80));
    } catch (e) {
      console.error("FAIL:", (e as Error).message);
    }
  }
}
main();
