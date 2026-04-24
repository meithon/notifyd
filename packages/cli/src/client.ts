import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@notifyd/server/router';

const DEFAULT_URL = 'http://127.0.0.1:7777';

/**
 * Resolve the base URL from explicit arg, env var, or default.
 * Strips any trailing /trpc so callers get the bare server origin.
 */
export function resolveBaseUrl(explicit?: string): string {
  const raw = explicit ?? process.env.NOTIFYD_URL ?? DEFAULT_URL;
  return raw.replace(/\/trpc\/?$/, '').replace(/\/$/, '');
}

/**
 * Get the tRPC endpoint URL (base + /trpc).
 */
export function getTrpcUrl(explicit?: string): string {
  return `${resolveBaseUrl(explicit)}/trpc`;
}

/**
 * Get the SSE stream endpoint URL (base + /events/stream).
 */
export function getSseUrl(explicit?: string): string {
  return `${resolveBaseUrl(explicit)}/events/stream`;
}

export function createClient(url?: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getTrpcUrl(url),
      }),
    ],
  });
}

export type Client = ReturnType<typeof createClient>;