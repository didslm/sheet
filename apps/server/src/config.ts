import 'node:process';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  wsPort: Number(env.WS_PORT ?? 4001),
  databaseUrl: env.DATABASE_URL ?? 'postgres://opensheets:opensheets@localhost:5432/opensheets',
  docStorage: (env.DOC_STORAGE ?? 'fs') as 'fs' | 's3',
  docStorageDir: env.DOC_STORAGE_DIR ?? './data/docs',
  defaultTtlDays: Number(env.DEFAULT_TTL_DAYS ?? 14),
  maxTtlDays: Number(env.MAX_TTL_DAYS ?? 30),
  rateLimitCreatePerDay: Number(env.RATE_LIMIT_CREATE_PER_DAY ?? 10),
  maxDocBytes: Number(env.MAX_DOC_BYTES ?? 5 * 1024 * 1024),
};
