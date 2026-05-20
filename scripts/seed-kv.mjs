#!/usr/bin/env node
/**
 * seed-kv.mjs — push seed/data.json into the JOBS_KV namespace at key
 * "jobs:all". Idempotent (overwrites the key).
 *
 * Usage:
 *   npm run seed:kv -- [--local|--remote] [--preview]
 *
 * Modes:
 *   --local  (default in dev)  writes to Miniflare's local KV via
 *                              .wrangler/state — what `npm run dev` reads.
 *   --remote                   writes to the actual Cloudflare KV namespace
 *                              defined in wrangler.toml — production seed.
 *
 * Requires `wrangler` available in PATH and a JOBS_KV namespace declared
 * in the root wrangler.toml.
 */

import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');

const args = process.argv.slice(2);
const useRemote = args.includes('--remote');
const useLocal = args.includes('--local') || !useRemote; // default = local
// `wrangler pages dev` binds to the preview namespace ID in local mode,
// so for --local seeds we ALWAYS write to the preview namespace too.
// For --remote, default to the production namespace unless --preview is
// passed explicitly.
const usePreview = useLocal ? true : args.includes('--preview');
const persistTo = resolve(REPO_ROOT, '.wrangler/state');

const raw = await readFile(SEED_PATH, 'utf8');
const parsed = JSON.parse(raw);
parsed.updated_at = new Date().toISOString();
const payload = JSON.stringify(parsed);

console.log(
  `Seeding JOBS_KV[jobs:all] (${payload.length} bytes, ${parsed.jobs?.length ?? 0} jobs) → ` +
    `${useLocal ? 'LOCAL' : 'REMOTE'}${usePreview ? ' [preview]' : ''}…`,
);

// `wrangler kv key put` reads value from a file when given --path
const scratchDir = await mkdtemp(join(tmpdir(), 'seed-kv-'));
const scratchFile = join(scratchDir, 'jobs-all.json');
await writeFile(scratchFile, payload);

const wranglerArgs = [
  'kv',
  'key',
  'put',
  '--binding=JOBS_KV',
  ...(usePreview ? ['--preview'] : ['--preview=false']),
  ...(useLocal
    ? ['--local', `--persist-to=${persistTo}`]
    : ['--remote']),
  '--path',
  scratchFile,
  'jobs:all',
];

const child = spawn('wrangler', wranglerArgs, { cwd: REPO_ROOT, stdio: 'inherit', shell: true });
child.on('exit', code => process.exit(code ?? 1));
