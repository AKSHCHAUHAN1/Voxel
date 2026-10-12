CREATE TABLE "WorkspacePlugin" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "widgetTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "installedById" UUID,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePlugin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspacePlugin_workspaceId_pluginId_key"
    ON "WorkspacePlugin"("workspaceId", "pluginId");
CREATE INDEX "WorkspacePlugin_pluginId_version_idx"
    ON "WorkspacePlugin"("pluginId", "version");
CREATE INDEX "WorkspacePlugin_installedById_installedAt_idx"
    ON "WorkspacePlugin"("installedById", "installedAt");

ALTER TABLE "WorkspacePlugin"
    ADD CONSTRAINT "WorkspacePlugin_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspacePlugin"
    ADD CONSTRAINT "WorkspacePlugin_installedById_fkey"
    FOREIGN KEY ("installedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
