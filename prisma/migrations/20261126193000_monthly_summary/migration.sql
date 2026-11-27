-- Monthly summary email: per-shop opt-out and the last month summarized.
ALTER TABLE "Shop" ADD COLUMN "monthlySummary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN "summaryMonth" TEXT;
