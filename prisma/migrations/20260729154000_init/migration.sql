-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "refundPolicy" TEXT,
    "shippingPolicy" TEXT,
    "supportEmail" TEXT,
    "autoDraft" BOOLEAN NOT NULL DEFAULT true,
    "minFightAmountCents" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "orderId" TEXT,
    "orderName" TEXT,
    "customerId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "networkReasonCode" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "initiatedAt" DATETIME NOT NULL,
    "evidenceDueBy" DATETIME,
    "evidenceSentOn" DATETIME,
    "finalizedOn" DATETIME,
    "snapshot" TEXT,
    "snapshotAt" DATETIME,
    "score" INTEGER,
    "recommendation" TEXT,
    "assessment" TEXT,
    "decision" TEXT,
    "redactedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "fields" TEXT NOT NULL,
    "savedToShopifyAt" DATETIME,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceDraft_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "disputeId" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "shopId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "packs" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("shopId", "period"),
    CONSTRAINT "UsageCounter_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GdprRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "customerId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "Dispute_shopId_status_idx" ON "Dispute"("shopId", "status");

-- CreateIndex
CREATE INDEX "Dispute_shopId_customerId_idx" ON "Dispute"("shopId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_shopId_shopifyId_key" ON "Dispute"("shopId", "shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceDraft_disputeId_version_key" ON "EvidenceDraft"("disputeId", "version");

-- CreateIndex
CREATE INDEX "Activity_shopId_createdAt_idx" ON "Activity"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "GdprRequest_shopDomain_topic_idx" ON "GdprRequest"("shopDomain", "topic");
