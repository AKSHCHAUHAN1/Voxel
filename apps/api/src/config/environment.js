import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  VOXEL_API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  VOXEL_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  VOXEL_STORAGE_ENDPOINT: z.string().url().optional(),
  VOXEL_STORAGE_BUCKET: z.string().min(3).max(63).optional(),
  VOXEL_STORAGE_REGION: z.string().min(1).optional(),
  VOXEL_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  VOXEL_STORAGE_SECRET_KEY: z.string().min(1).optional(),
  VOXEL_EMAIL_DELIVERY_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  VOXEL_EMAIL_DELIVERY_TOKEN: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  VOXEL_EMAIL_FROM: z.preprocess((value) => value === '' ? undefined : value, z.string().email().optional()),
}).refine(
  (environment) => Boolean(environment.GOOGLE_CLIENT_ID) === Boolean(environment.GOOGLE_CLIENT_SECRET),
  { message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must either both be set or both be empty.' },
).refine(
  (environment) => environment.NODE_ENV !== 'production' || [
    environment.VOXEL_STORAGE_ENDPOINT,
    environment.VOXEL_STORAGE_BUCKET,
    environment.VOXEL_STORAGE_REGION,
    environment.VOXEL_STORAGE_ACCESS_KEY,
    environment.VOXEL_STORAGE_SECRET_KEY,
  ].every(Boolean),
  { message: 'Production requires complete S3-compatible object storage configuration.' },
).refine(
  (environment) => environment.NODE_ENV !== 'production' || [
    environment.VOXEL_EMAIL_DELIVERY_URL,
    environment.VOXEL_EMAIL_DELIVERY_TOKEN,
    environment.VOXEL_EMAIL_FROM,
  ].every(Boolean),
  { message: 'Production requires a configured email delivery webhook, token, and sender address.' },
).refine(
  (environment) => environment.NODE_ENV !== 'production' || (Boolean(environment.VOXEL_EMAIL_DELIVERY_URL) && new URL(environment.VOXEL_EMAIL_DELIVERY_URL).protocol === 'https:'),
  { message: 'Production email delivery must use HTTPS.' },
).refine(
  (environment) => environment.NODE_ENV !== 'production' || (Boolean(environment.VOXEL_STORAGE_ENDPOINT) && new URL(environment.VOXEL_STORAGE_ENDPOINT).protocol === 'https:'),
  { message: 'Production object storage must use HTTPS.' },
);

export const parseEnvironment = (input) => environmentSchema.parse(input);
