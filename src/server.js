import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
import { ensureStorage } from './lib/paths.js';
import { logger } from './lib/logger.js';
import { registerApiRoutes } from './routes/api.js';

await ensureStorage();

const app = Fastify({
  logger: false,
  bodyLimit: config.maxUploadBytes
});

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: {
    fileSize: config.maxUploadBytes,
    files: 200000
  }
});
await app.register(staticPlugin, {
  root: config.publicDir,
  prefix: '/'
});
await registerApiRoutes(app);

app.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled request error', {
    route: request.url,
    message: error.message
  });
  reply.code(error.statusCode || 500).send({
    error: error.message || 'Unexpected server error'
  });
});

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info('REGION server started', {
    url: `http://${config.host}:${config.port}`
  });
} catch (error) {
  logger.error('REGION server failed to start', { message: error.message });
  process.exit(1);
}
