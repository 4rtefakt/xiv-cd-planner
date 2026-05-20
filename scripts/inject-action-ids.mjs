#!/usr/bin/env node
/**
 * inject-action-ids.mjs — adds action_id (xivapi/FFLogs gameID) on
 * every ability in seed/data.json. Used by the FFLogs import to map
 * cast events to our ability rows.
 *
 * Source : scripts/ability-icons.json (produced by find-icon-ids.mjs).
 * Idempotent : re-running is a no-op when the data is already in.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const seed = JSON.parse(await readFile(resolve(REPO_ROOT, 'seed/data.json'), 'utf8'));
const icons = JSON.parse(await readFile(resolve(REPO_ROOT, 'scripts/ability-icons.json'), 'utf8')).matches;

// Manual overrides for abilities the CSV match missed at first.
const MANUAL_ACTION_IDS = {
  'BRD.WardensPaean': 3561, // The Warden's Paean (lowercase 'the' in the CSV missed the match)
};

let updated = 0;
let missing = [];
for (const job of seed.jobs) {
  for (const ab of job.abilities) {
    const actionId = icons[ab.id]?.action_id ?? MANUAL_ACTION_IDS[ab.id];
    if (actionId && ab.action_id !== actionId) {
      ab.action_id = actionId;
      updated++;
    } else if (!actionId && !ab.action_id) {
      missing.push(ab.id);
    }
  }
}

seed.updated_at = new Date().toISOString();
await writeFile(resolve(REPO_ROOT, 'seed/data.json'), JSON.stringify(seed, null, 2) + '\n', 'utf8');

console.log(`✓ action_id set on ${updated} ability/-ies`);
if (missing.length > 0) console.warn(`! ${missing.length} still missing: ${missing.join(', ')}`);
