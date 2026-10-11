import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';
import { prisma } from '../../database/prisma.js';
import { AuthService } from '../auth/auth-service.js';
import { parseEnvironment } from '../../config/environment.js';

const environment = parseEnvironment(process.env);
const authService = new AuthService(prisma, environment);
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const createHocuspocusServer = () => {
  const server = new Server({
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    quiet: environment.NODE_ENV === 'test',
    
    extensions: [
      new Redis({
        host: new URL(environment.REDIS_URL).hostname,
        port: Number(new URL(environment.REDIS_URL).port || 6379),
      }),
    ],

    async onAuthenticate(data) {
      const identity = await authService.verifyRealtimeToken(data.token, data.documentName);
      if (!identity) throw new Error('A valid dashboard session is required.');
      data.connectionConfig.readOnly = !['OWNER', 'ADMIN', 'EDITOR'].includes(identity.role);
      return {
        user: {
          id: identity.user.id,
          displayName: identity.user.displayName,
          avatarUrl: identity.user.avatarUrl,
        },
        role: identity.role,
        sessionId: identity.sessionId,
      };
    },

    async beforeHandleMessage(data) {
      const context = data.context;
      const role = await authService.isRealtimeSessionActive(
        context?.user?.id,
        context?.sessionId,
        data.documentName,
      );
      if (!role) {
        data.connection.close();
        throw new Error('Realtime access has expired or been revoked.');
      }
      data.connection.readOnly = !['OWNER', 'ADMIN', 'EDITOR'].includes(role);
    },

    async beforeHandleAwareness(data) {
      const connection = data.connection;
      if (!connection) return;
      const role = await authService.isRealtimeSessionActive(
        data.context?.user?.id,
        data.context?.sessionId,
        data.documentName,
      );
      if (!role) {
        connection.close();
        throw new Error('Realtime access has expired or been revoked.');
      }
      connection.readOnly = !['OWNER', 'ADMIN', 'EDITOR'].includes(role);
    },

    async onLoadDocument(data) {
      // documentName is expected to be the dashboard ID
      const dashboardId = data.documentName;
      const dashboard = await prisma.dashboard.findFirst({
        where: { id: dashboardId, deletedAt: null }
      });
      
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }
      
      if (dashboard.scene && typeof dashboard.scene === 'object') {
        const yScene = data.document.getMap('scene');
        const metadata = data.document.getMap('voxelMeta');
        data.document.transact(() => {
          for (const [key, value] of Object.entries(dashboard.scene)) {
            yScene.set(key, value);
          }
          metadata.set('dashboardVersion', dashboard.version);
        });
      }
      
      return data.document;
    },

    async onStoreDocument(data) {
      const dashboardId = data.documentName;
      const sceneJson = data.document.getMap('scene').toJSON();
      const metadata = data.document.getMap('voxelMeta');
      const baseVersion = Number(metadata.get('dashboardVersion'));
      const dashboard = await prisma.dashboard.findFirst({
        where: { id: dashboardId, deletedAt: null },
        select: { id: true, version: true, scene: true, status: true },
      });
      if (!dashboard || dashboard.status === 'ARCHIVED') return;

      // REST edits (including public share edits) are canonical. Adopt their
      // version when this document already contains the same scene, and never
      // let an older in-memory Yjs document overwrite a newer REST edit.
      if (canonicalJson(sceneJson) === canonicalJson(dashboard.scene)) {
        if (baseVersion !== dashboard.version) metadata.set('dashboardVersion', dashboard.version);
        return;
      }
      if (!Number.isInteger(baseVersion) || baseVersion !== dashboard.version) {
        const canonicalScene = dashboard.scene && typeof dashboard.scene === 'object' ? dashboard.scene : {};
        const yScene = data.document.getMap('scene');
        data.document.transact(() => {
          for (const key of Array.from(yScene.keys())) {
            if (!(key in canonicalScene)) yScene.delete(key);
          }
          for (const [key, value] of Object.entries(canonicalScene)) yScene.set(key, value);
          metadata.set('dashboardVersion', dashboard.version);
        });
        return;
      }

      const updatedVersion = dashboard.version + 1;
      const saved = await prisma.$transaction(async (transaction) => {
        const result = await transaction.dashboard.updateMany({
          where: { id: dashboard.id, version: baseVersion, deletedAt: null, status: { not: 'ARCHIVED' } },
          data: { scene: sceneJson, version: { increment: 1 } },
        });
        if (result.count !== 1) return false;
        await transaction.dashboardVersion.create({
          data: { dashboardId: dashboard.id, version: updatedVersion, scene: sceneJson },
        });
        return true;
      });
      if (saved) metadata.set('dashboardVersion', updatedVersion);
    },
  });

  return server;
};
