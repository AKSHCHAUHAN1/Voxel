CREATE TABLE "WidgetPluginInstall" (
    "id" UUID NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "workspaceId" UUID,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetPluginInstall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WidgetPluginInstall_pluginId_installedAt_idx"
    ON "WidgetPluginInstall"("pluginId", "installedAt");
CREATE INDEX "WidgetPluginInstall_workspaceId_installedAt_idx"
    ON "WidgetPluginInstall"("workspaceId", "installedAt");

ALTER TABLE "WidgetPluginInstall"
    ADD CONSTRAINT "WidgetPluginInstall_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WidgetPluginReview" (
    "id" UUID NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetPluginReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WidgetPluginReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "WidgetPluginReview_pluginId_userId_key"
    ON "WidgetPluginReview"("pluginId", "userId");
CREATE INDEX "WidgetPluginReview_pluginId_createdAt_idx"
    ON "WidgetPluginReview"("pluginId", "createdAt");

ALTER TABLE "WidgetPluginReview"
    ADD CONSTRAINT "WidgetPluginReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
