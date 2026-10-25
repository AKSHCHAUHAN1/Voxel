import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workspaceEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(workspaceEnvPath)) process.loadEnvFile(workspaceEnvPath);

const [{ buildApp }, { parseEnvironment }, { createHocuspocusServer }, { purgeExpiredTrash, processStorageDeletionQueue }, { redis }, { createCredentialRateLimiter }] = await Promise.all([
  import('./app.js'),
  import('./config/environment.js'),
  import('./features/realtime/hocuspocus.js'),
  import('./features/workspaces/workspace-retention.js'),
  import('./lib/redis.js'),
  import('./features/auth/credential-rate-limit.js'),
]);
const { createObjectStorage } = await import('./features/files/object-storage.js');

const environment = parseEnvironment(process.env);
const readinessChecks = { redis: () => redis.ping() };
let storage;
if (environment.VOXEL_STORAGE_ENDPOINT) {
  storage = createObjectStorage({
    endpoint: environment.VOXEL_STORAGE_ENDPOINT,
    bucket: environment.VOXEL_STORAGE_BUCKET,
    region: environment.VOXEL_STORAGE_REGION,
    accessKey: environment.VOXEL_STORAGE_ACCESS_KEY,
    secretKey: environment.VOXEL_STORAGE_SECRET_KEY,
  });
  readinessChecks.storage = () => storage.check();
}
const app = await buildApp(environment, {
  readinessChecks,
  accountRateLimiter: createCredentialRateLimiter(redis, environment.SESSION_SECRET),
  rateLimitRedis: redis,
});

const hocuspocusServer = createHocuspocusServer();
let retentionTimer;
let storageCleanupTimer;
let storageCleanupRunning = false;

const close = async (signal) => {
  app.log.info({ signal }, 'Stopping Voxel API');
  if (retentionTimer) clearInterval(retentionTimer);
  if (storageCleanupTimer) clearInterval(storageCleanupTimer);
  await hocuspocusServer.destroy();
  await redis.quit().catch(() => redis.disconnect());
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
const runTrashRetention = async () => {
  try {
    await purgeExpiredTrash();
  } catch (error) {
    app.log.error({ err: error }, 'Workspace trash cleanup failed');
  }
};
const runStorageCleanup = async () => {
  if (!storage || storageCleanupRunning) return;
  storageCleanupRunning = true;
  try {
    await processStorageDeletionQueue(storage, {
      batchSize: 20,
      onError: (error, jobId) => app.log.error({ err: error, jobId }, 'Stored object cleanup will retry later'),
    });
  } catch (error) {
    app.log.error({ err: error }, 'Stored object cleanup queue could not be processed');
  } finally {
    storageCleanupRunning = false;
  }
};
void runTrashRetention();
retentionTimer = setInterval(runTrashRetention, 60 * 60 * 1000);
retentionTimer.unref();
void runStorageCleanup();
storageCleanupTimer = setInterval(runStorageCleanup, 60 * 1000);
storageCleanupTimer.unref();
