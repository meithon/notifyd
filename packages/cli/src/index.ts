import { Command } from 'commander';
import { createClient, getSseUrl } from './client.js';
import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';

const program = new Command();

program
  .name('notify')
  .description('CLI for notifyd — local notification hub')
  .version('0.0.1')
  .option('-u, --url <url>', 'notifyd server URL', process.env.NOTIFYD_URL ?? 'http://127.0.0.1:7777');

function shellEscape(value: string): string {
  // Escape characters that the shell would interpret: $ ` \ ! " '
  // Wraps in single quotes and escapes any single quotes within.
  // For values inside double-quotes, we need to escape $ ` \ and "
  return value.replace(/([$`\\"])/g, '\\$1');
}

function expandMetaFields(command: string, meta: Record<string, unknown> | undefined): string {
  // Replace ${meta.KEY} with meta[KEY] (flat key)
  // Replace ${meta.KEY.SUB} with meta[KEY][SUB] (nested dot notation)
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

function executeCommand(command: string, event: Record<string, unknown>): void {
  const expanded = command
    .replace(/\$\{title\}/g, shellEscape(String(event.title ?? '')))
    .replace(/\$\{message\}/g, shellEscape(String(event.message ?? '')))
    .replace(/\$\{level\}/g, shellEscape(String(event.level ?? 'info')))
    .replace(/\$\{group\}/g, shellEscape(String(event.group ?? '')))
    .replace(/\$\{meta\}/g, event.meta ? shellEscape(JSON.stringify(event.meta)) : '');
  const withMetaFields = expandMetaFields(expanded, event.meta as Record<string, unknown> | undefined);

  const env = {
    ...process.env,
    NOTIFYD_EVENT: JSON.stringify(event),
  };

  exec(withMetaFields, { env, timeout: 30_000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Command failed: ${error.message}`);
    }
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  });
}

// --- notify send ---
program
  .command('send')
  .description('Send an event to notifyd')
  .requiredOption('-t, --title <title>', 'Event title')
  .option('-m, --message <message>', 'Event message')
  .option('-l, --level <level>', 'Event level (info, warn, error)', 'info')
  .option('-p, --process-id <processId>', 'Process ID')
  .option('-g, --group <group>', 'Group name (validates meta against group schema)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--meta <meta>', 'JSON metadata (or @file.json to read from file)')
  .action(async (options) => {
    const url = program.opts().url;
    const client = createClient(url);
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
    let meta: Record<string, unknown> | undefined;
    if (options.meta) {
      const metaStr = options.meta.startsWith('@')
        ? readFileSync(options.meta.slice(1), 'utf-8')
        : options.meta;
      meta = JSON.parse(metaStr);
    }

    try {
      const event = await client.event.publish.mutate({
        title: options.title,
        message: options.message,
        level: options.level,
        process_id: options.processId,
        group: options.group,
        tags,
        meta,
      });
      console.log(JSON.stringify(event, null, 2));
    } catch (error) {
      console.error('Failed to send event:', error);
      process.exit(1);
    }
  });

// --- notify subscribe ---
program
  .command('subscribe')
  .description('Subscribe to events and execute a command locally')
  .requiredOption('-c, --command <command>', 'Shell command to run on each event. Templates: ${title}, ${message}, ${level}, ${group}, ${meta}, ${meta_KEY}')
  .option('--group-filter <groups>', 'Only receive events matching these groups (comma-separated)')
  .action(async (options) => {
    const url = program.opts().url;
    const sseUrl = getSseUrl(url);

    const groupFilter = options.groupFilter
      ? options.groupFilter.split(',').map((g: string) => g.trim())
      : undefined;

    console.log(`Subscribing to ${sseUrl}...`);

    const response = await fetch(sseUrl, {
      headers: { Accept: 'text/event-stream' },
    });

    if (!response.ok) {
      console.error(`Failed to connect: HTTP ${response.status}`);
      process.exit(1);
    }

    if (!response.body) {
      console.error('No response body');
      process.exit(1);
    }

    console.log('Connected. Listening for events...');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);

            // Filter by group filter if specified
            if (groupFilter && groupFilter.length > 0) {
              if (!event.group || !groupFilter.includes(event.group)) {
                continue;
              }
            }

            executeCommand(options.command, event);
          } catch {
            // Ignore malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Connection lost:', error);
      process.exit(1);
    }
  });

// --- notify group ---
const groupCmd = program.command('group').description('Manage groups');

// group register
groupCmd
  .command('register')
  .description('Register a group with a JSON Schema for metadata validation')
  .requiredOption('-n, --name <name>', 'Group name')
  .requiredOption('-s, --schema <schema>', 'JSON Schema (or @file.json to read from file)')
  .option('-d, --description <description>', 'Group description')
  .action(async (options) => {
    const url = program.opts().url;
    const client = createClient(url);
    const schemaStr = options.schema.startsWith('@')
      ? readFileSync(options.schema.slice(1), 'utf-8')
      : options.schema;
    const schema = JSON.parse(schemaStr);

    try {
      const group = await client.group.register.mutate({
        name: options.name,
        schema,
        description: options.description,
      });
      console.log(JSON.stringify(group, null, 2));
    } catch (error) {
      console.error('Failed to register group:', error);
      process.exit(1);
    }
  });

// group list
groupCmd
  .command('list')
  .description('List all registered groups')
  .action(async () => {
    const url = program.opts().url;
    const client = createClient(url);
    try {
      const groups = await client.group.list.query();
      console.log(JSON.stringify(groups, null, 2));
    } catch (error) {
      console.error('Failed to list groups:', error);
      process.exit(1);
    }
  });

// group remove
groupCmd
  .command('remove')
  .description('Remove a group')
  .argument('<name>', 'Group name to remove')
  .action(async (name) => {
    const url = program.opts().url;
    const client = createClient(url);
    try {
      const result = await client.group.remove.mutate({ name });
      if (result.success) {
        console.log(`Group "${name}" removed`);
      } else {
        console.error(`Group "${name}" not found`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to remove group:', error);
      process.exit(1);
    }
  });

program.parse();