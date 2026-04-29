import { describe, expect, it } from 'vitest';
import { expandCommandTemplate, shellEscape } from './command-template.js';

describe('shellEscape', () => {
  it('escapes $, backtick, and backslash', () => {
    expect(shellEscape('a$b`c\\d')).toBe('a\\$b\\`c\\\\d');
  });

  it('does not escape double quotes', () => {
    expect(shellEscape('{"k":"v"}')).toBe('{"k":"v"}');
  });
});

describe('expandCommandTemplate', () => {
  it('expands ${meta} as JSON without escaping double quotes', () => {
    const out = expandCommandTemplate("echo '${meta}'", {
      meta: { ssh: 'home', tmux_session: '$3' },
    });
    expect(out).toBe("echo '{\"ssh\":\"home\",\"tmux_session\":\"\\$3\"}'");
  });

  it('expands nested meta fields', () => {
    const out = expandCommandTemplate('echo ${meta.ctx.pane}', {
      meta: { ctx: { pane: '%3' } },
    });
    expect(out).toBe('echo %3');
  });
});
