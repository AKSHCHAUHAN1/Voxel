ALTER TABLE "User"
ADD COLUMN "website" TEXT,
ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb;
