-- First-run setup guide can be dismissed from the home page.
ALTER TABLE "Shop" ADD COLUMN "setupDismissedAt" DATETIME;
