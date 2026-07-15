import { buildApp } from './app.js';
import { parseEnvironment } from './config/environment.js';

const environment = parseEnvironment(process.env);
const app = await buildApp(environment);

const close = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'Stopping Voxel API');
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));

await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
