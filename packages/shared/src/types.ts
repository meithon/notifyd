import type { z } from 'zod';
import type {
  EventSchema,
  PublishEventInputSchema,
  EventLevelSchema,
  RegisterGroupInputSchema,
  GroupSchema,
  RemoveGroupInputSchema,
} from './schemas.js';

export type Event = z.infer<typeof EventSchema>;
export type PublishEventInput = z.infer<typeof PublishEventInputSchema>;
export type EventLevel = z.infer<typeof EventLevelSchema>;
export type RegisterGroupInput = z.infer<typeof RegisterGroupInputSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type RemoveGroupInput = z.infer<typeof RemoveGroupInputSchema>;