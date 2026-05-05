import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { migrate } from './db.js';
import { registerRoutes } from './routes.js';
import { startWsServer } from './yws.js';

async function main() {
  await migrate();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await registerRoutes(app);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  startWsServer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
