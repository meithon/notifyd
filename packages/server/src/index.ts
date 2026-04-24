import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { appRouter } from './router.js';
import { createContext } from './trpc.js';
import { subscribe } from './sse.js';

const port = parseInt(process.env.PORT ?? '7777', 10);
const host = process.env.HOST ?? '0.0.0.0';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      console.error(`Error in tRPC handler on path '${path}':`, error);
    },
  } satisfies FastifyTRPCPluginOptions<typeof appRouter>['trpcOptions'],
});

// Health check
server.get('/health', async () => {
  return { status: 'ok' };
});

// SSE endpoint for subscribe command
server.get('/events/stream', (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  reply.raw.write(':\n\n'); // Initial comment to establish connection

  // Send keep-alive comments every 15 seconds to prevent proxy/client timeouts
  const keepAlive = setInterval(() => {
    try {
      reply.raw.write(':\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 15_000);

  const unsubscribe = subscribe((data) => {
    reply.raw.write(data);
  });

  request.raw.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

(async () => {
  try {
    await server.listen({ port, host });
    console.log(`notifyd listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
})();