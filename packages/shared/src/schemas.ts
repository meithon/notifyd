import { z } from 'zod';

// --- Event level ---
export const EventLevelSchema = z.enum(['info', 'warn', 'error']);

// --- Publish Event (input from sender) ---
export const PublishEventInputSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  level: EventLevelSchema.optional().default('info'),
  process_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  group: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

// --- Event (full, with server-generated fields) ---
export const EventSchema = PublishEventInputSchema.extend({
  id: z.string(),
  time: z.string(), // ISO 8601
});

// --- Group ---
export const RegisterGroupInputSchema = z.object({
  name: z.string().min(1),
  schema: z.record(z.unknown()), // JSON Schema object
  description: z.string().optional(),
});

export const GroupSchema = z.object({
  name: z.string().min(1),
  schema: z.record(z.unknown()),
  description: z.string().optional(),
  created_at: z.string(),
});

export const RemoveGroupInputSchema = z.object({
  name: z.string().min(1),
});