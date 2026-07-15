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
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;

export const parseEnvironment = (input: NodeJS.ProcessEnv): Environment =>
  environmentSchema.parse(input);
