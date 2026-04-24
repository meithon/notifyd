import { publicProcedure, router } from './trpc.js';
import { PublishEventInputSchema } from '@notifyd/shared';
import { groupStore } from './group-store.js';
import { broadcast } from './sse.js';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';

export const eventRouter = router({
  publish: publicProcedure
    .input(PublishEventInputSchema)
    .mutation(async ({ input }) => {
      // Validate meta against group schema if group is specified
      if (input.group) {
        const error = groupStore.validateMeta(input.group, input.meta);
        if (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Validation failed for group "${input.group}": ${error}`,
          });
        }
      }

      const event = {
        ...input,
        id: randomUUID(),
        time: new Date().toISOString(),
      };

      // Broadcast to all SSE subscribers
      broadcast(event);

      return event;
    }),
});