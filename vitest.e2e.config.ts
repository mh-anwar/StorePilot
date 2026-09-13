import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// End to end: the real route modules and the real Shopify library, with
// Shopify itself replaced by test/e2e/fake-shopify.ts behind fetch.
const DATABASE_URL = "file:./test-e2e.sqlite";
process.env.DATABASE_URL = DATABASE_URL; // for globalSetup

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["test/e2e/**/*.test.ts"],
    env: {
      DATABASE_URL,
      NODE_ENV: "test",
      SHOPIFY_API_KEY: "e2e-client-id",
      SHOPIFY_API_SECRET: "e2e-client-secret",
      SHOPIFY_APP_URL: "https://storepilot.test",
      BILLING_TEST_MODE: "true",
    },
    globalSetup: ["test/setup/global-db.ts"],
    setupFiles: ["test/e2e/setup-fetch.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
