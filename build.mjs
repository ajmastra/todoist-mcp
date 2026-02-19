#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = join(__dirname, 'dist', 'index.js');

await esbuild.build({
  entryPoints: [join(__dirname, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile,
  format: 'esm',
  minify: false,
  sourcemap: true,
  // Keep these external so Node loads them at runtime (avoids CJS require() inside ESM bundle)
  external: [
    '@doist/todoist-api-typescript',
    '@modelcontextprotocol/sdk',
    'chrono-node',
    'zod',
  ],
});

await chmod(outfile, 0o755);
