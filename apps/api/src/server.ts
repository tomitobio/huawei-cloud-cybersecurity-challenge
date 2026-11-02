import http from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { initSocket } from './socket';
import { prisma } from './db';

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] Huawei Cloud Cybersecurity Challenge API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
