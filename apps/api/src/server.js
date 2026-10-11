import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workspaceEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(workspaceEnvPath)) process.loadEnvFile(workspaceEnvPath);

const [{ buildApp }, { parseEnvironment }, { createHocuspocusServer }, { purgeExpiredTrash }] = await Promise.all([
  import('./app.js'),
  import('./config/environment.js'),
  import('./features/realtime/hocuspocus.js'),
  import('./features/workspaces/workspace-retention.js'),
]);

const environment = parseEnvironment(process.env);
const app = await buildApp(environment);

const hocuspocusServer = createHocuspocusServer();
let retentionTimer;

const close = async (signal) => {
  app.log.info({ signal }, 'Stopping Voxel API');
  if (retentionTimer) clearInterval(retentionTimer);
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
const runTrashRetention = () => purgeExpiredTrash().catch((error) => {
  app.log.error({ err: error }, 'Workspace trash cleanup failed');
});
void runTrashRetention();
retentionTimer = setInterval(runTrashRetention, 60 * 60 * 1000);
retentionTimer.unref();
