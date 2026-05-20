#!/usr/bin/env node
/**
 * inject-icon-urls.mjs — one-shot data plumbing tool.
 *
 * Updates seed/data.json in place:
 *   - jobs[].icon → `https://cdn.jsdelivr.net/gh/xivapi/classjob-icons@master/icons/<slug>.png`
 *     (slug derived from job name lowercase, mirroring xiv-party-builder).
 *   - jobs[].abilities[].icon → `https://xivapi.com<path>` from the matches
 *     file produced by find-icon-ids.mjs. Falls back to the original
 *     symbolic name on miss (so the React glyph fallback can still kick in).
 *
 * Manual overrides cover names the CSV match missed.
 *
 * Usage:
 *   node scripts/inject-icon-urls.mjs scripts/ability-icons.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const matchesPath = process.argv[2] ?? resolve(REPO_ROOT, 'scripts/ability-icons.json');

const JOB_ICON_BASE = 'https://cdn.jsdelivr.net/gh/xivapi/classjob-icons@master/icons';
const ABILITY_ICON_BASE = 'https://xivapi.com';

// Slug used by xivapi/classjob-icons (matches the convention used by
// xiv-party-builder/lib/jobs.js).
const JOB_SLUGS = {
  PLD: 'paladin', WAR: 'warrior', DRK: 'darkknight', GNB: 'gunbreaker',
  WHM: 'whitemage', AST: 'astrologian', SCH: 'scholar', SGE: 'sage',
  MNK: 'monk', DRG: 'dragoon', NIN: 'ninja', SAM: 'samurai',
  RPR: 'reaper', VPR: 'viper',
  BRD: 'bard', MCH: 'machinist', DNC: 'dancer',
  BLM: 'blackmage', SMN: 'summoner', RDM: 'redmage', PCT: 'pictomancer',
};

// Manual icon paths for abilities the CSV name-match couldn't find.
// Verified by hand on the FFXIV Wiki + cafemaker /action endpoint.
const MANUAL_ICON_PATHS = {
  'BRD.WardensPaean': '/i/002000/002609.png', // action 3561 "the Warden's Paean"
};

const seedPath = resolve(REPO_ROOT, 'seed/data.json');
const seed = JSON.parse(await readFile(seedPath, 'utf8'));
const matches = JSON.parse(await readFile(matchesPath, 'utf8')).matches;

let abilityUpdates = 0;
let abilityMisses = 0;

for (const job of seed.jobs) {
  // Job icon → CDN URL (or fallback to existing local path if unknown code).
  const slug = JOB_SLUGS[job.code];
  if (slug) job.icon = `${JOB_ICON_BASE}/${slug}.png`;

  for (const ab of job.abilities) {
    const manual = MANUAL_ICON_PATHS[ab.id];
    const match = matches[ab.id];
    const path = manual ?? match?.icon_path;
    if (path) {
      // Keep the symbolic glyph name as fallback in a separate field.
      ab.icon_glyph = ab.icon;
      ab.icon = `${ABILITY_ICON_BASE}${path}`;
      ab.icon_id = match?.icon_id;
      abilityUpdates++;
    } else {
      abilityMisses++;
      console.warn(`miss: ${ab.id} (${ab.name})`);
    }
  }
}

seed.updated_at = new Date().toISOString();
await writeFile(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');

console.log(`✓ jobs icons set for ${seed.jobs.length} jobs`);
console.log(`✓ ability icons set for ${abilityUpdates} abilities (${abilityMisses} misses)`);
