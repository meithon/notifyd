import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  outfile: '../../bin/notify',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['undici'],
});