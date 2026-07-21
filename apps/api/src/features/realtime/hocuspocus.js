import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';
import { prisma } from '../../database/prisma.js';
import { AuthService } from '../auth/auth-service.js';
import { parseEnvironment } from '../../config/environment.js';

const environment = parseEnvironment(process.env);
const authService = new AuthService(prisma, environment);

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
      const { token } = data;
      if (!token) {
        return { user: { id: 'guest', displayName: 'Guest' } };
      }
      
      const user = await authService.getAuthenticatedUser(token).catch(() => null);
      if (!user) {
        return { user: { id: 'guest', displayName: 'Guest' } };
      }
      return { user };
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
        data.document.transact(() => {
          for (const [key, value] of Object.entries(dashboard.scene)) {
            yScene.set(key, value);
          }
        });
      }
      
      return data.document;
    },

    async onStoreDocument(data) {
      const dashboardId = data.documentName;
      // Convert Yjs document state to json representation for our Prisma model
      // We will actually just save it as binary base64 or json if needed.
      // Hocuspocus provides the raw Yjs doc in data.document
      const sceneJson = data.document.getMap('scene').toJSON();
      
      await prisma.dashboard.update({
        where: { id: dashboardId },
        data: { scene: sceneJson }
      });
    },
  });

  return server;
};
