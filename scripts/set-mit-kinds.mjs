#!/usr/bin/env node
/**
 * set-mit-kinds.mjs — one-shot tool that flags the seed's abilities
 * that mitigate ONLY physical or ONLY magical damage (everything else
 * is 'all', implicit via absent mit_kind field).
 *
 * Source: per-ability wiki entries.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');

/** id → mit_kind. Anything not listed stays 'all' (implicit). */
const KIND_OVERRIDES = {
  // Phys-only : block rate is parry-style, only triggers on physical hits.
  'PLD.Bulwark': 'physical',
  // Magic-leaning mitigations modelled as magic-only here (their phys
  // component is small enough to be noise in raid planning).
  'DRK.DarkMind':         'magical',
  'DRK.DarkMissionary':   'magical',
  'GNB.HeartOfLight':     'magical',
  'SCH.FeyIllumination':  'magical',
  'RDM.MagickBarrier':    'magical',
};

const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));

let updated = 0;
for (const job of seed.jobs) {
  for (const ab of job.abilities) {
    const kind = KIND_OVERRIDES[ab.id];
    if (!kind) continue;
    if (ab.mit_kind === kind) continue;
    ab.mit_kind = kind;
    updated++;
  }
}

seed.updated_at = new Date().toISOString();
await writeFile(SEED_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`Set mit_kind on ${updated} ability/-ies.`);
