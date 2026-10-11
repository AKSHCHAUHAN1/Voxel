ALTER TABLE "DashboardComment"
  ADD COLUMN "parentId" UUID,
  ADD COLUMN "resolvedById" UUID,
  ADD COLUMN "anchor" JSONB,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "DashboardComment_dashboardId_parentId_createdAt_idx"
  ON "DashboardComment"("dashboardId", "parentId", "createdAt");

ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "DashboardComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
