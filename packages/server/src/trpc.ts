import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

/**
 * Minimal context type — keeps Fastify types out of the exported router type
 * so that consumer packages (e.g. CLI) don't need fastify as a dependency.
 */
export type Context = Record<string, never>;

export function createContext(_opts: CreateFastifyContextOptions): Context {
  return {};
}

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;
export const router = t.router;
export const createCallerFactory = t.createCallerFactory;