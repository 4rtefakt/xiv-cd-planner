#!/usr/bin/env node
/**
 * fetch-tooltip-data.mjs — backfills the rich-tooltip fields on every
 * ability in seed/data.json from xivapi :
 *   - description      ←  /action/{id}?language=en  → Description
 *   - description_fr   ←  /action/{id}?language=fr  → Description
 *   - max_charges      ←  MaxCharges (only kept when > 1)
 *   - affinity         ←  ClassJobCategory truthy keys (job codes)
 *
 * Idempotent : abilities already carrying a description are skipped
 * unless --force is passed. Manual overrides at the bottom plug the
 * holes where xivapi returns empty / unhelpful data.
 *
 * Note : shares_recast_with isn't fetched here — xivapi doesn't expose
 * the cooldown-group mapping cleanly. Set those manually when you
 * notice them (e.g. Drill / Bioblaster / Air Anchor share a recast).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');

const FORCE = process.argv.includes('--force');

/** Strip xivapi's HTML-ish markup ("<Emphasis>", "<SoftHyphen/>", …)
 *  from a description string. We render plain text in the tooltip. */
function cleanDesc(s) {
  if (!s) return null;
  let out = s
    .replace(/<SoftHyphen\/?>/gi, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return out || null;
}

/** xivapi exposes the affinity as a pre-joined display string under
 *  ClassJobCategory.Name (EN) and Name_fr (FR), already abbreviated
 *  the way the in-game tooltip shows them ("GLA PGL MRD …"). We store
 *  both strings verbatim — the tooltip picks per locale. */
function affinityFromCjc(cjc) {
  if (!cjc || typeof cjc !== 'object') return null;
  const en = typeof cjc.Name_en === 'string' && cjc.Name_en.trim() ? cjc.Name_en.trim() : null;
  const fr = typeof cjc.Name_fr === 'string' && cjc.Name_fr.trim() ? cjc.Name_fr.trim() : null;
  if (!en && !fr) return null;
  return { en, fr };
}

async function fetchOne(actionId, lang) {
  try {
    const url = `https://xivapi.com/action/${actionId}?language=${lang}&columns=Description,MaxCharges,ClassJobCategory`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));

const allAbilities = seed.jobs.flatMap((j) => j.abilities);
const todo = allAbilities.filter((a) => {
  if (!a.action_id) return false;
  if (FORCE) return true;
  // Missing any of the tooltip fields → fetch. Affinity is optional
  // (some actions have no class affinity at all) — we use !.affinity
  // AND !.affinity_fr to mean "never tried", not "tried and empty".
  return !a.description || !a.description_fr || (!a.affinity && !a.affinity_fr);
});
console.log(`Fetching tooltip data for ${todo.length} ability/-ies${FORCE ? ' (force)' : ''}…`);

const BATCH = 6;
let updates = 0;
let misses = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  await Promise.all(
    chunk.map(async (ab) => {
      const [en, fr] = await Promise.all([fetchOne(ab.action_id, 'en'), fetchOne(ab.action_id, 'fr')]);
      if (!en && !fr) {
        misses++;
        return;
      }
      const descEn = cleanDesc(en?.Description);
      const descFr = cleanDesc(fr?.Description);
      if (descEn) ab.description = descEn;
      if (descFr) ab.description_fr = descFr;

      const charges = en?.MaxCharges ?? fr?.MaxCharges;
      if (typeof charges === 'number' && charges > 1) {
        ab.max_charges = charges;
      } else if ('max_charges' in ab && (!charges || charges <= 1)) {
        delete ab.max_charges;
      }

      // ClassJobCategory.Name_en/Name_fr is the same across language
      // queries (it's just stored fields), so either response is fine.
      const aff = affinityFromCjc(en?.ClassJobCategory ?? fr?.ClassJobCategory);
      if (aff?.en) ab.affinity = aff.en;
      if (aff?.fr) ab.affinity_fr = aff.fr;
      updates++;
    }),
  );
  process.stdout.write(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`);
}

seed.updated_at = new Date().toISOString();
await writeFile(SEED_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');

console.log(`\n✓ tooltip data set on ${updates} ability/-ies, ${misses} missed`);
