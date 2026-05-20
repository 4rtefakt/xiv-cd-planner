#!/usr/bin/env node
/**
 * fetch-fr-names.mjs — one-shot tool that adds French translations
 * (`name_fr`) to every job and ability in seed/data.json.
 *
 * Jobs : the official French names are a closed list (21 jobs), so they
 * live here as a hardcoded map. Faster + immune to xivapi flakiness.
 *
 * Abilities : queried from xivapi /action/{id}?columns=Name&language=fr.
 * Action IDs come from scripts/ability-icons.json (produced by
 * find-icon-ids.mjs). Manual overrides cover the names the CSV-match
 * missed at first (Warden's Paean) AND any ability whose xivapi entry
 * has an empty French name.
 *
 * Idempotent : re-running only re-fetches missing or stale entries.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');
const ICONS_PATH = resolve(REPO_ROOT, 'scripts/ability-icons.json');

const JOB_NAMES_FR = {
  PLD: 'Paladin',
  WAR: 'Guerrier',
  DRK: 'Chevalier noir',
  GNB: 'Pistosabreur',
  WHM: 'Mage blanc',
  SCH: 'Érudit',
  AST: 'Astromancien',
  SGE: 'Sage',
  MNK: 'Moine',
  DRG: 'Chevalier dragon',
  NIN: 'Ninja',
  SAM: 'Samouraï',
  RPR: 'Faucheur',
  VPR: 'Vipère',
  BRD: 'Barde',
  MCH: 'Machiniste',
  DNC: 'Danseur',
  BLM: 'Mage noir',
  SMN: 'Invocateur',
  RDM: 'Mage rouge',
  PCT: 'Pictomancien',
};

/** Manual overrides for ability ids whose xivapi entry returns an
 *  unexpected or missing French name. Keys = ability.id from the seed. */
const ABILITY_NAME_OVERRIDES = {
  'BRD.WardensPaean': "Hymne du gardien",
};

async function fetchFrName(actionId) {
  try {
    const res = await fetch(`https://xivapi.com/action/${actionId}?columns=Name&language=fr`);
    if (!res.ok) return null;
    const j = await res.json();
    const name = (j?.Name ?? '').trim();
    return name || null;
  } catch {
    return null;
  }
}

const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const icons = JSON.parse(await readFile(ICONS_PATH, 'utf8')).matches;

// Apply job names
let jobUpdates = 0;
for (const job of seed.jobs) {
  const fr = JOB_NAMES_FR[job.code];
  if (fr && job.name_fr !== fr) {
    job.name_fr = fr;
    jobUpdates++;
  }
}

// Apply ability names — batch the xivapi requests in groups of 8 so
// we don't melt the API while keeping total runtime ~20s for 148 calls.
const allAbilities = seed.jobs.flatMap((j) => j.abilities);
const todo = allAbilities.filter((a) => !a.name_fr || ABILITY_NAME_OVERRIDES[a.id]);
console.log(`Fetching FR names for ${todo.length} ability/-ies (skipping already set)…`);

const BATCH = 8;
let abilityUpdates = 0;
let abilityMisses = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  await Promise.all(
    chunk.map(async (ab) => {
      const override = ABILITY_NAME_OVERRIDES[ab.id];
      if (override) {
        ab.name_fr = override;
        abilityUpdates++;
        return;
      }
      const actionId = icons[ab.id]?.action_id;
      if (!actionId) {
        abilityMisses++;
        return;
      }
      const fr = await fetchFrName(actionId);
      if (fr) {
        ab.name_fr = fr;
        abilityUpdates++;
      } else {
        abilityMisses++;
      }
    }),
  );
  process.stdout.write(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`);
}

seed.updated_at = new Date().toISOString();
await writeFile(SEED_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');

console.log(`\n✓ jobs   : ${jobUpdates} name_fr set`);
console.log(`✓ abilities : ${abilityUpdates} name_fr set, ${abilityMisses} missed`);
