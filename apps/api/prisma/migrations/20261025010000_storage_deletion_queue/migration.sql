CREATE TABLE "StorageDeletionJob" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageDeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageDeletionJob_storageKey_key" ON "StorageDeletionJob"("storageKey");
CREATE INDEX "StorageDeletionJob_createdAt_idx" ON "StorageDeletionJob"("createdAt");
