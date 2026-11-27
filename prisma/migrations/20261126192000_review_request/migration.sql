-- When the app last asked Shopify to show the review modal (after a won dispute).
ALTER TABLE "Shop" ADD COLUMN "reviewRequestedAt" DATETIME;
