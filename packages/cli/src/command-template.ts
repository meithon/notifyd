export function shellEscape(value: string): string {
  // Escape shell-special chars, but keep double quotes as-is.
  // This allows consumers to wrap placeholders in single quotes when needed.
  return value.replace(/([$`\\])/g, '\\$1');
}

export function expandMetaFields(command: string, meta: Record<string, unknown> | undefined): string {
  return command.replace(/\$\{meta\.([a-zA-Z0-9_.]+)\}/g, (_, path) => {
    if (!meta) return '';
    const parts = path.split('.');
    let value: unknown = meta;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    return value == null ? '' : shellEscape(String(value));
  });
}

export function expandCommandTemplate(command: string, event: Record<string, unknown>): string {
  const expanded = command
    .replace(/\$\{title\}/g, shellEscape(String(event.title ?? '')))
    .replace(/\$\{message\}/g, shellEscape(String(event.message ?? '')))
    .replace(/\$\{level\}/g, shellEscape(String(event.level ?? 'info')))
    .replace(/\$\{group\}/g, shellEscape(String(event.group ?? '')))
    .replace(/\$\{meta\}/g, event.meta ? shellEscape(JSON.stringify(event.meta)) : '');
  return expandMetaFields(expanded, event.meta as Record<string, unknown> | undefined);
}
