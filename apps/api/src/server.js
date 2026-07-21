import { buildApp } from './app.js';
import { parseEnvironment } from './config/environment.js';
import { createHocuspocusServer } from './features/realtime/hocuspocus.js';

const environment = parseEnvironment(process.env);
const app = await buildApp(environment);

const hocuspocusServer = createHocuspocusServer();

const close = async (signal) => {
  app.log.info({ signal }, 'Stopping Voxel API');
  await hocuspocusServer.destroy();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => close('SIGINT'));
process.on('SIGTERM', () => close('SIGTERM'));

app.server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/api/v1/realtime')) {
    hocuspocusServer.crossws.handleUpgrade(request, socket, head);
  }
});

await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
