#!/usr/bin/env node
/**
 * seed-kv.mjs — push seed/data.json into the JOBS_KV namespace at key
 * "jobs:all". Idempotent (overwrites the key).
 *
 * Usage:
 *   npm run seed:kv -- [--preview]
 *
 * Requires `wrangler` available in PATH. Reads the KV binding from the
 * root wrangler.toml. The KV namespace must exist beforehand (create it
 * with `wrangler kv namespace create JOBS_KV`).
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');

const args = process.argv.slice(2);
const usePreview = args.includes('--preview');

const raw = await readFile(SEED_PATH, 'utf8');
const parsed = JSON.parse(raw);
parsed.updated_at = new Date().toISOString();

const payload = JSON.stringify(parsed);
console.log(`Seeding JOBS_KV[jobs:all] (${payload.length} bytes, ${parsed.jobs?.length ?? 0} jobs)…`);

const wranglerArgs = [
  'kv',
  'key',
  'put',
  '--binding=JOBS_KV',
  ...(usePreview ? ['--preview'] : ['--preview=false']),
  '--remote',
  'jobs:all',
  payload,
];

const child = spawn('wrangler', wranglerArgs, { cwd: REPO_ROOT, stdio: 'inherit', shell: true });
child.on('exit', code => process.exit(code ?? 1));
