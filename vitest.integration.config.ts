import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Service-level tests against a real SQLite database and the mock Admin API.
// Files share one database, so they run one at a time.
const DATABASE_URL = "file:./test-integration.sqlite";
process.env.DATABASE_URL = DATABASE_URL; // for globalSetup, which runs in this process

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    env: { DATABASE_URL, NODE_ENV: "test" },
    globalSetup: ["test/setup/global-db.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
