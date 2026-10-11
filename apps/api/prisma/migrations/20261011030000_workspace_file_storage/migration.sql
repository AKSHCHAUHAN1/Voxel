-- Add workspace storage accounting and metadata for S3-compatible file objects.
ALTER TABLE "Workspace"
  ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "storageQuotaBytes" BIGINT NOT NULL DEFAULT 1073741824;

CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "uploaderId" UUID,
    "storageKey" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");
CREATE INDEX "StoredFile_workspaceId_deletedAt_createdAt_idx" ON "StoredFile"("workspaceId", "deletedAt", "createdAt");
CREATE INDEX "StoredFile_uploaderId_createdAt_idx" ON "StoredFile"("uploaderId", "createdAt");

ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
