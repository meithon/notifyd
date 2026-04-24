import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync } from 'node:child_process';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const BIN = join(ROOT, 'bin/notify');
const SERVER = join(ROOT, 'packages/server/dist/index.js');

let server: ChildProcess;
let port: number;
let url: string;

function notify(args: string): string {
  return execSync(`${BIN} ${args}`, {
    encoding: 'utf-8',
    timeout: 5000,
    env: { ...process.env, NOTIFYD_URL: url },
  });
}

function notifyJson(args: string): unknown {
  return JSON.parse(notify(args));
}

async function waitForServer(url: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

describe('notifyd e2e', () => {
  beforeAll(async () => {
    port = 17777 + Math.floor(Math.random() * 1000);
    url = `http://127.0.0.1:${port}`;

    server = spawn('node', [SERVER], {
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    await waitForServer(`http://127.0.0.1:${port}/health`);
  }, 30_000);

  afterAll(() => {
    server?.kill();
  });

  describe('send', () => {
    it('sends an event with title only', () => {
      const event = notifyJson('send --title "hello"');
      expect(event).toMatchObject({ title: 'hello', level: 'info' });
    });

    it('sends an event with message and level', () => {
      const event = notifyJson('send --title "build failed" --message "see logs" --level error');
      expect(event).toMatchObject({ title: 'build failed', message: 'see logs', level: 'error' });
    });

    it('sends an event with tags', () => {
      const event = notifyJson('send --title "tagged" --tags ci,deploy');
      expect(event).toMatchObject({ title: 'tagged', tags: ['ci', 'deploy'] });
    });
  });

  describe('group', () => {
    it('registers a group', () => {
      const group = notifyJson(
        `group register --name deploy --schema '{"type":"object","properties":{"env":{"type":"string","enum":["staging","production"]}},"required":["env"]}' --description "Deployment events"`,
      );
      expect(group).toMatchObject({ name: 'deploy' });
    });

    it('sends an event with valid group meta', () => {
      const event = notifyJson(
        `send --title "deploy frontend" --group deploy --meta '{"env":"staging"}'`,
      );
      expect(event).toMatchObject({ title: 'deploy frontend', group: 'deploy' });
    });

    it('rejects an event with invalid group meta', () => {
      expect(() => notify(`send --title "bad" --group deploy --meta '{"env":"invalid"}'`)).toThrow();
    });

    it('lists groups', () => {
      const list = JSON.parse(notify('group list'));
      expect(Array.isArray(list)).toBe(true);
      expect(list).toContainEqual(expect.objectContaining({ name: 'deploy' }));
    });

    it('removes a group', () => {
      const result = notify('group remove deploy');
      expect(result).toContain('removed');
    });
  });

  describe('subscribe', () => {
    it('receives events via SSE and executes command', async () => {
      const received: string[] = [];

      const sub = spawn(BIN, ['subscribe', '--command', 'echo ${title}'], {
        env: { ...process.env, NOTIFYD_URL: url },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      sub.stdout.on('data', (data: Buffer) => {
        received.push(data.toString().trim());
      });

      // Wait for SSE connection to establish
      await new Promise((r) => setTimeout(r, 1500));

      notify('send --title "sse-test-event"');

      // Wait for event delivery + command execution
      await new Promise((r) => setTimeout(r, 2000));

      sub.kill();
      await new Promise((r) => setTimeout(r, 500));

      expect(received.some((e) => e.includes('sse-test-event'))).toBe(true);
    }, 10_000);

    it('filters events by group', async () => {
      // Register a group for filtering
      notifyJson(`group register --name ci --schema '{"type":"object","properties":{"repo":{"type":"string"}},"required":["repo"]}'`);

      const received: string[] = [];

      const sub = spawn(BIN, ['subscribe', '--command', 'echo ${title}', '--group-filter', 'ci'], {
        env: { ...process.env, NOTIFYD_URL: url },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      sub.stdout.on('data', (data: Buffer) => {
        received.push(data.toString().trim());
      });

      await new Promise((r) => setTimeout(r, 1500));

      // Send event WITHOUT group — should be filtered out
      notify('send --title "no-group-event"');
      await new Promise((r) => setTimeout(r, 1000));

      // Send event WITH matching group
      notify(`send --title "ci-event" --group ci --meta '{"repo":"notifyd"}'`);
      await new Promise((r) => setTimeout(r, 2000));

      sub.kill();
      await new Promise((r) => setTimeout(r, 500));

      // Clean up
      notify('group remove ci');

      expect(received.some((e) => e.includes('ci-event'))).toBe(true);
      expect(received.some((e) => e.includes('no-group-event'))).toBe(false);
    }, 15_000);
  });
});