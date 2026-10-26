import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const isCI = Boolean(process.env.CI);
const e2eEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  API_HOST: '0.0.0.0',
  API_PORT: '3000',
  TRUST_PROXY: 'true',
  VOXEL_PUBLIC_APP_URL: 'http://127.0.0.1:5173',
  VOXEL_API_PUBLIC_URL: 'http://127.0.0.1:3000',
  VITE_VOXEL_API_URL: '',
  DATABASE_URL:
    process.env.VOXEL_E2E_DATABASE_URL ??
    'postgresql://voxel:voxel@127.0.0.1:5432/voxel?schema=public',
  REDIS_URL: process.env.VOXEL_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379',
  SESSION_SECRET: 'voxel-e2e-session-secret-not-for-production-0000',
  MFA_ENCRYPTION_KEY: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  VOXEL_EMAIL_DELIVERY_URL: '',
  VOXEL_EMAIL_DELIVERY_TOKEN: '',
  VOXEL_EMAIL_FROM: '',
  VOXEL_STORAGE_ENDPOINT: 'http://127.0.0.1:9000',
  VOXEL_STORAGE_BUCKET: 'voxel-assets',
  VOXEL_STORAGE_REGION: 'us-east-1',
  VOXEL_STORAGE_ACCESS_KEY: 'voxel',
  VOXEL_STORAGE_SECRET_KEY: 'voxel-development-only',
};

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: './test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start --workspace=@voxel/api',
      url: 'http://127.0.0.1:3000/health/live',
      env: e2eEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'npm run dev --workspace=@voxel/web -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      env: e2eEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
