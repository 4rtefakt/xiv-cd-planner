#!/usr/bin/env node
/**
 * add-level-variants.mjs — one-shot migration that teaches seed/data.json
 * the level-scaling convention used by resolveAbilityAtLevel :
 *
 *   base fields = the ability's LOWEST-level form (at level_unlocked)
 *   level_variants[K] = patch applying from level K upward
 *
 * Two kinds of entries are produced :
 *
 * 1. TRAITS — the ability keeps its identity but a stat changes at the
 *    trait level (Enhanced Reprisal 98 : 10s → 15s, Enhanced Swiftcast
 *    94 : 60s → 40s, …). The current seed stored the POST-trait value
 *    as base ; we move it into the variant and downgrade the base.
 *
 * 2. ACTION UPGRADES — the whole identity swaps at the upgrade level
 *    (Sheltron → Holy Sheltron 82, Vengeance → Damnation 92, …). The
 *    current seed only had the max-level form ; we fetch the base
 *    form's name/icon/description from xivapi, install it as base, and
 *    move the previous fields into level_variants[upgradeLevel].
 *
 * Also removes PLD.DivineCaress (WHM-only spell, data-entry mistake).
 *
 * Idempotent : abilities that already have level_variants are skipped.
 * Run from the repo root : node scripts/add-level-variants.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'seed/data.json');

/** Same markup-stripping as fetch-tooltip-data.mjs. */
function cleanDesc(s) {
  if (!s) return null;
  const out = s
    .replace(/<SoftHyphen\/?>/gi, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return out || null;
}

async function fetchAction(id, lang) {
  const url = `https://xivapi.com/action/${id}?language=${lang}&columns=Name,Description,Icon`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`xivapi ${id} (${lang}) → HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ *
 * 1. TRAITS — { abilityIdSuffix → spec }                              *
 *    base: fields to FORCE on the base (pre-trait values)             *
 *    at:   trait level                                                *
 *    patch: fields the trait grants (usually the current base value)  *
 *    descReplace: [pattern, replacement] applied to description +     *
 *    description_fr to derive the PRE-trait text (the original text   *
 *    moves into the variant).                                         *
 * ------------------------------------------------------------------ */
const TRAITS = [
  {
    match: /\.(Reprisal)$/,
    at: 98, // Enhanced Reprisal
    base: { effect: 10 },
    patchFrom: ['effect'],
    descReplace: [/15\s*s/g, '10s'],
  },
  {
    match: /\.(Feint)$/,
    at: 98, // Enhanced Feint
    base: { effect: 10 },
    patchFrom: ['effect'],
    descReplace: [/15\s*s/g, '10s'],
  },
  {
    match: /\.(Addle)$/,
    at: 98, // Enhanced Addle
    base: { effect: 10 },
    patchFrom: ['effect'],
    descReplace: [/15\s*s/g, '10s'],
  },
  {
    match: /\.(Swiftcast)$/,
    at: 94, // Enhanced Swiftcast
    base: { recast: 60 },
    patchFrom: ['recast'],
    descReplace: null, // recast isn't part of the tooltip text
  },
  {
    match: /\.(Troubadour|Tactician|ShieldSamba)$/,
    at: 98, // Enhanced Troubadour/Tactician/Shield Samba II : 10% → 15%
    base: { mit_potency: 10, recast: 120 },
    patchFrom: ['mit_potency'],
    descReplace: [/15\s*%/g, '10%'],
    // Enhanced Troubadour/Tactician/Shield Samba (without the II) is a
    // SEPARATE lvl-88 trait : recast 120s → 90s. Patched from the
    // current seed value (90).
    extra: { 88: ['recast'] },
  },
  {
    match: /\.(DeploymentTactics)$/,
    at: 88, // Enhanced Deployment Tactics
    base: { recast: 120 },
    patchFrom: ['recast'],
    descReplace: null,
  },
  {
    match: /\.(DivineBenison)$/,
    at: 88, // Enhanced Divine Benison → 2 charges
    base: { max_charges: undefined },
    patchFrom: [],
    explicitPatch: { max_charges: 2 },
    descReplace: [/\n*Maximum (Charges|de charges)\s*:\s*2/gi, ''],
  },
  // NOTE : pas d'« Enhanced Dismantle » en 7.x (vérifié sur le wiki +
  // liste des traits MCH) — Dismantle reste à 1 charge, rien à scaler.
  {
    match: /\.(RadiantAegis)$/,
    at: 88, // Enhanced Radiant Aegis → 2 charges
    base: { max_charges: undefined },
    patchFrom: [],
    explicitPatch: { max_charges: 2 },
    descReplace: [/\n*Maximum (Charges|de charges)\s*:\s*2/gi, ''],
  },
];

/* ------------------------------------------------------------------ *
 * 2. ACTION UPGRADES — base form installed from xivapi + hand-checked *
 *    stats ; the seed's current (max-level) fields move into          *
 *    level_variants[upgradeLevel].                                    *
 *    Stats verified on ffxiv.consolegameswiki.com (patch 7.x).        *
 * ------------------------------------------------------------------ */
const UPGRADES = [
  {
    id: 'PLD.Sheltron',
    upgradeAt: 82,
    base: {
      action_id: 3542,
      level_unlocked: 35,
      effect: 6,
      mit_potency: 15,
      recast: 5,
      _note: 'Oath gauge cost 50. Upgrades to Holy Sheltron at 82.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Sheltron',
    },
  },
  {
    id: 'PLD.Sentinel',
    upgradeAt: 92,
    base: {
      action_id: 17,
      level_unlocked: 38,
      effect: 15,
      mit_potency: 30,
      recast: 120,
      _note: '30% mit. Upgrades to Guardian at 92.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Sentinel',
    },
  },
  {
    id: 'WAR.Vengeance',
    upgradeAt: 92,
    base: {
      action_id: 44,
      level_unlocked: 38,
      effect: 15,
      mit_potency: 30,
      recast: 120,
      _note: '30% mit + 55p counter. Upgrades to Damnation at 92.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Vengeance',
    },
  },
  {
    id: 'WAR.Bloodwhetting',
    upgradeAt: 82,
    base: {
      action_id: 3551,
      level_unlocked: 56,
      effect: 6,
      mit_potency: 10,
      recast: 25,
      _note: '10% mit + sustain. Upgrades to Bloodwhetting at 82.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Raw_Intuition',
    },
  },
  {
    id: 'DRK.ShadowedVigil',
    upgradeAt: 92,
    base: {
      action_id: 3636,
      level_unlocked: 38,
      effect: 15,
      mit_potency: 30,
      recast: 120,
      _note: '30% mit. Upgrades to Shadowed Vigil at 92.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Shadow_Wall',
    },
  },
  {
    id: 'GNB.GreatNebula',
    upgradeAt: 92,
    base: {
      action_id: 16148,
      level_unlocked: 38,
      effect: 15,
      mit_potency: 30,
      recast: 120,
      _note: '30% mit. Upgrades to Great Nebula at 92.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Nebula',
    },
  },
  {
    id: 'GNB.HeartOfCorundum',
    upgradeAt: 82,
    base: {
      action_id: 16161,
      level_unlocked: 68,
      effect: 7,
      mit_potency: 15,
      recast: 25,
      _note: 'Single ally 15% mit. Upgrades to Heart of Corundum at 82.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Heart_of_Stone',
    },
  },
  {
    id: 'SAM.ThirdEye',
    upgradeAt: 82,
    base: {
      action_id: 7498,
      level_unlocked: 6,
      effect: 4,
      mit_potency: 10,
      recast: 15,
      _note: '10% mit on next hit. Upgrades to Tengentsu at 82.',
      _source_url: 'https://ffxiv.consolegameswiki.com/wiki/Third_Eye',
    },
  },
];

/** Fields that define an ability's identity — moved into the variant
 *  when the action upgrades, replaced on base by the low-level form. */
const IDENTITY_FIELDS = [
  'name', 'name_fr', 'icon', 'icon_id', 'action_id',
  'description', 'description_fr', 'recast', 'effect', 'mit_potency', '_note',
];

const data = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const report = { traits: 0, upgrades: 0, removed: 0, warnings: [] };

const allAbilities = [];
for (const job of data.jobs) for (const ab of job.abilities) allAbilities.push(ab);

/* ---- 0. remove PLD.DivineCaress (WHM lvl-100 spell, not PLD) ---- */
for (const job of data.jobs) {
  const before = job.abilities.length;
  job.abilities = job.abilities.filter((ab) => ab.id !== 'PLD.DivineCaress');
  report.removed += before - job.abilities.length;
}

/* ---- 1. traits ---- */
for (const ab of allAbilities) {
  for (const spec of TRAITS) {
    if (!spec.match.test(ab.id)) continue;
    if (ab.level_variants) { report.warnings.push(`${ab.id}: already has variants, skipped`); continue; }

    const patch = { ...(spec.explicitPatch ?? {}) };
    for (const f of spec.patchFrom) patch[f] = ab[f];

    // Derive pre-trait descriptions from the current (post-trait) text.
    if (spec.descReplace) {
      const [re, repl] = spec.descReplace;
      for (const f of ['description', 'description_fr']) {
        if (typeof ab[f] !== 'string') continue;
        const downgraded = ab[f].replace(re, repl);
        if (downgraded !== ab[f]) {
          patch[f] = ab[f];     // post-trait text → variant
          ab[f] = downgraded;   // pre-trait text → base
        } else {
          report.warnings.push(`${ab.id}: descReplace had no effect on ${f}`);
        }
      }
    }

    // Secondary trait levels : patch listed fields from their CURRENT
    // seed value (e.g. songs' recast 90 moves into the lvl-88 variant).
    const variants = { [spec.at]: patch };
    if (spec.extra) {
      for (const [lvl, fields] of Object.entries(spec.extra)) {
        const p = {};
        for (const f of fields) p[f] = ab[f];
        variants[lvl] = p;
      }
    }

    // Downgrade the base stats.
    for (const [k, v] of Object.entries(spec.base)) {
      if (v === undefined) delete ab[k];
      else ab[k] = v;
    }

    ab.level_variants = variants;
    report.traits++;
  }
}

/* ---- 2. action upgrades ---- */
for (const spec of UPGRADES) {
  const ab = allAbilities.find((a) => a.id === spec.id);
  if (!ab) { report.warnings.push(`${spec.id}: not found`); continue; }
  if (ab.level_variants && Object.keys(ab.level_variants).some((k) => Number(k) === spec.upgradeAt)) {
    report.warnings.push(`${spec.id}: upgrade variant already present, skipped`);
    continue;
  }

  // Snapshot the current (max-level) identity into the variant.
  const variant = {};
  for (const f of IDENTITY_FIELDS) if (ab[f] !== undefined) variant[f] = ab[f];

  // Fetch the base form from xivapi (EN + FR).
  const [en, fr] = await Promise.all([
    fetchAction(spec.base.action_id, 'en'),
    fetchAction(spec.base.action_id, 'fr'),
  ]);
  if (!en?.Name) throw new Error(`${spec.id}: xivapi returned no Name for ${spec.base.action_id}`);

  ab.name = en.Name;
  ab.name_fr = fr?.Name ?? en.Name;
  ab.icon = `https://xivapi.com${en.Icon}`;
  ab.icon_id = parseInt(en.Icon.match(/(\d+)\.png$/)?.[1] ?? '0', 10) || undefined;
  ab.description = cleanDesc(en.Description) ?? undefined;
  ab.description_fr = cleanDesc(fr?.Description) ?? undefined;
  for (const [k, v] of Object.entries(spec.base)) ab[k] = v;
  ab.verified = true;

  // Drop identity fields from the variant that ended up identical.
  for (const f of Object.keys(variant)) {
    if (variant[f] === ab[f]) delete variant[f];
  }

  ab.level_variants = { ...(ab.level_variants ?? {}), [spec.upgradeAt]: variant };
  report.upgrades++;
}

data.updated_at = new Date().toISOString();
// Update the stale note about upgrade chains.
if (Array.isArray(data._notes)) {
  data._notes = data._notes.map((n) =>
    n.startsWith('Upgrade chains')
      ? 'Upgrade chains (Sheltron→Holy Sheltron, Sentinel→Guardian, Vengeance→Damnation, Raw Intuition→Bloodwhetting, Shadow Wall→Shadowed Vigil, Nebula→Great Nebula, Heart of Stone→Heart of Corundum, Third Eye→Tengentsu) store the LOW-level form as base and the upgrade in level_variants[upgradeLevel]. Trait scaling (Enhanced Reprisal/Feint/Addle/Swiftcast/…) works the same way.'
      : n,
  );
}

await writeFile(SEED_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
