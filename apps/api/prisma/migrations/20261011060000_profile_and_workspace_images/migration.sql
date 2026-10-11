CREATE TYPE "StoredFilePurpose" AS ENUM ('WORKSPACE', 'AVATAR', 'COVER');

ALTER TABLE "Workspace" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "StoredFile" ADD COLUMN "purpose" "StoredFilePurpose" NOT NULL DEFAULT 'WORKSPACE';
