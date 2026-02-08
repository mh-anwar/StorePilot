import "dotenv/config";
import { seed } from "../src/lib/seed";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

seed(databaseUrl)
  .then((stats) => {
    console.log("\nSeed statistics:", stats);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
