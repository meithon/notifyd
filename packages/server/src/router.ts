import { router } from './trpc.js';
import { eventRouter } from './event-router.js';
import { groupRouter } from './group-router.js';

export const appRouter = router({
  event: eventRouter,
  group: groupRouter,
});

export type AppRouter = typeof appRouter;