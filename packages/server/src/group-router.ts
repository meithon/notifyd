import { publicProcedure, router } from './trpc.js';
import {
  RegisterGroupInputSchema,
  RemoveGroupInputSchema,
} from '@notifyd/shared';
import { groupStore } from './group-store.js';

export const groupRouter = router({
  register: publicProcedure
    .input(RegisterGroupInputSchema)
    .mutation(({ input }) => {
      return groupStore.register(input);
    }),

  list: publicProcedure.query(() => {
    return groupStore.list();
  }),

  remove: publicProcedure
    .input(RemoveGroupInputSchema)
    .mutation(({ input }) => {
      const removed = groupStore.remove(input.name);
      return { success: removed };
    }),
});