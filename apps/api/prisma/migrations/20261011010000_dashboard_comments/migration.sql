-- CreateTable
CREATE TABLE "DashboardComment" (
    "id" UUID NOT NULL,
    "dashboardId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DashboardComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardComment_dashboardId_createdAt_idx" ON "DashboardComment"("dashboardId", "createdAt");

-- CreateIndex
CREATE INDEX "DashboardComment_authorId_createdAt_idx" ON "DashboardComment"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
