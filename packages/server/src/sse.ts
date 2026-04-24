// SSE broadcaster: pushes events to all connected subscribe clients

type SSEClient = (data: string) => void;

const clients: Set<SSEClient> = new Set();

/**
 * Register an SSE client. Returns an unsubscribe function.
 */
export function subscribe(client: SSEClient): () => void {
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

/**
 * Broadcast an event to all connected SSE clients.
 */
export function broadcast(event: Record<string, unknown>): void {
  const data = JSON.stringify(event);
  const message = `data: ${data}\n\n`;
  for (const client of clients) {
    try {
      client(message);
    } catch {
      clients.delete(client);
    }
  }
}