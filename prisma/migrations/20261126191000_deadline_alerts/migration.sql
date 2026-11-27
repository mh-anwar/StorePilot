-- Deadline alert emails: per-shop opt-out and address, per-dispute last stage sent.
ALTER TABLE "Shop" ADD COLUMN "deadlineAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN "alertEmail" TEXT;
ALTER TABLE "Dispute" ADD COLUMN "alertStage" INTEGER;
