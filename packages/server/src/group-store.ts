import type { Group } from '@notifyd/shared';
import { Ajv } from 'ajv';

const groups = new Map<string, Group>();
const ajv = new Ajv({ strict: false });

export const groupStore = {
  register(input: { name: string; schema: Record<string, unknown>; description?: string }): Group {
    // Validate that the schema itself is valid JSON Schema
    const validate = ajv.compile(input.schema);
    if (!validate) {
      throw new Error(`Invalid JSON Schema: ${ajv.errorsText()}`);
    }

    const group: Group = {
      name: input.name,
      schema: input.schema,
      description: input.description,
      created_at: new Date().toISOString(),
    };
    groups.set(group.name, group);
    return group;
  },

  list(): Group[] {
    return Array.from(groups.values());
  },

  get(name: string): Group | undefined {
    return groups.get(name);
  },

  remove(name: string): boolean {
    return groups.delete(name);
  },

  /** Validate meta against a group's schema. Returns null if valid, error message if not. */
  validateMeta(groupName: string, meta: Record<string, unknown> | undefined): string | null {
    const group = groups.get(groupName);
    if (!group) {
      return `Group "${groupName}" not found`;
    }

    const validate = ajv.compile(group.schema);
    const valid = validate(meta ?? {});
    if (!valid) {
      return ajv.errorsText(validate.errors);
    }
    return null;
  },
};