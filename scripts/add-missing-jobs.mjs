#!/usr/bin/env node
/**
 * add-missing-jobs.mjs — one-shot tool that appends the 13 jobs absent
 * from the original 8-job seed (Phase F). Data sourced from
 * ffxiv.consolegameswiki.com per-job pages, cross-checked with The
 * Balance basic guides where they expose stat tables (Dawntrail 7.5).
 *
 * Pipeline after running this :
 *   node scripts/find-icon-ids.mjs /tmp/action.csv > scripts/ability-icons.json
 *   node scripts/inject-icon-urls.mjs scripts/ability-icons.json
 *   npm run seed:kv -- --local
 *
 * The added entries use the same `icon` glyph-name placeholders as the
 * original seed before icon URLs were injected (D.1 pattern).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');

const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const existingCodes = new Set(seed.jobs.map((j) => j.code));

// Shared role-action helpers (replicated across jobs that have them, so
// the per-job-row ability list mirrors what the in-game hotbar shows).
const tankRoleActions = (jobCode) => [
  ab(`${jobCode}.Rampart`,    'Rampart',     90,  20, 'personal', 20, 'shield',   8,  true),
  ab(`${jobCode}.ArmsLength`, "Arm's Length",120, 6,  'personal', 0,  'triangle', 32, true),
  ab(`${jobCode}.Reprisal`,   'Reprisal',    60,  15, 'party',    10, 'diamond',  22, true),
];
const healerRoleActions = (jobCode) => [
  ab(`${jobCode}.Swiftcast`, 'Swiftcast', 40,  10, 'personal', 0, 'triangle', 18, true),
  ab(`${jobCode}.Surecast`,  'Surecast',  120, 6,  'personal', 0, 'triangle', 44, true),
];
const meleeRoleActions = (jobCode) => [
  ab(`${jobCode}.SecondWind`, 'Second Wind',  120, 0,  'heal',     0,  'cross',    8,  true),
  ab(`${jobCode}.Bloodbath`,  'Bloodbath',    90,  20, 'personal', 0,  'heart',    12, true),
  ab(`${jobCode}.Feint`,      'Feint',        90,  15, 'party',    10, 'diamond',  22, true),
  ab(`${jobCode}.ArmsLength`, "Arm's Length", 120, 6,  'personal', 0,  'triangle', 32, true),
];
const physRangedRoleActions = (jobCode) => [
  ab(`${jobCode}.SecondWind`, 'Second Wind',  120, 0, 'heal',     0, 'cross',    8,  true),
  ab(`${jobCode}.ArmsLength`, "Arm's Length", 120, 6, 'personal', 0, 'triangle', 32, true),
];
const casterRoleActions = (jobCode) => [
  ab(`${jobCode}.Addle`,     'Addle',     90,  15, 'party',    10, 'diamond',  8,  true),
  ab(`${jobCode}.Swiftcast`, 'Swiftcast', 40,  10, 'personal', 0,  'triangle', 18, true),
  ab(`${jobCode}.Surecast`,  'Surecast',  120, 6,  'personal', 0,  'triangle', 44, true),
];

function ab(id, name, recast, effect, mit_type, mit_potency, icon, level, verified, note) {
  const out = { id, name, recast, effect, mit_type, mit_potency, icon, level_unlocked: level, verified: !!verified };
  if (note) out._note = note;
  return out;
}

// Wiki source URLs are derived from the job code (consolegameswiki convention).
const wiki = (slug) => `https://ffxiv.consolegameswiki.com/wiki/${slug}`;

const newJobs = [
  // ===== TANK =====
  {
    code: 'DRK', name: 'Dark Knight', role: 'tank', sub_role: 'tank', position_order: 9,
    icon: '/icons/jobs/DRK.svg',
    abilities: [
      ...tankRoleActions('DRK'),
      ab('DRK.ShadowedVigil', 'Shadowed Vigil', 120, 15, 'personal', 40,  'shield',   92, true,  'Replaces Shadow Wall at lvl 92. 40% mit + 1200p heal at expire or HP<50%'),
      ab('DRK.DarkMind',      'Dark Mind',      60,  10, 'personal', 20,  'hex',      45, false, '20% magic / 10% phys mit. Modelled as 20% personal mit (magic emphasis)'),
      ab('DRK.DarkMissionary','Dark Missionary',90,  15, 'party',    10,  'aegis',    66, false, '10% magic / 5% phys party mit. Modelled as 10% party mit'),
      ab('DRK.Oblation',      'Oblation',       60,  10, 'party',    10,  'shield',   82, true,  '2 charges. Single ally 10% mit'),
      ab('DRK.TheBlackestNight','The Blackest Night', 15, 7, 'personal', 15, 'hex',    70, false, '25% maxHP shield. Modelled as 15% personal mit equivalent. 3000 MP cost.'),
      ab('DRK.LivingDead',    'Living Dead',    300, 10, 'personal', 100, 'sword',    50, true,  'Walking Dead state — heals back to full via attacks while active. Treated as invuln.'),
    ],
  },
  {
    code: 'GNB', name: 'Gunbreaker', role: 'tank', sub_role: 'tank', position_order: 10,
    icon: '/icons/jobs/GNB.svg',
    abilities: [
      ...tankRoleActions('GNB'),
      ab('GNB.Camouflage',      'Camouflage',         90,  20, 'personal', 10,  'shield',   6,  true,  '+50% parry rate + 10% mit'),
      ab('GNB.GreatNebula',     'Great Nebula',       120, 15, 'personal', 40,  'shield',   92, true,  'Replaces Nebula at lvl 92. 40% mit + 20% maxHP boost + heal'),
      ab('GNB.HeartOfLight',    'Heart of Light',     90,  15, 'party',    10,  'aegis',    64, false, '10% magic / 5% phys party mit. Modelled as 10% party mit'),
      ab('GNB.HeartOfCorundum', 'Heart of Corundum',  25,  8,  'party',    15,  'aegis',    82, true,  'Single ally 15% mit + 4s Clarity (15% more) + 900p delayed heal. 3 charges.'),
      ab('GNB.Aurora',          'Aurora',             60,  18, 'heal',     0,   'cross',    45, true,  '300p regen single ally. 2 charges.'),
      ab('GNB.Superbolide',     'Superbolide',        360, 10, 'personal', 100, 'sword',    50, true,  'Invulnerability. Drops HP to 1.'),
    ],
  },

  // ===== HEAL =====
  {
    code: 'AST', name: 'Astrologian', role: 'heal', sub_role: 'pure_healer', position_order: 11,
    icon: '/icons/jobs/AST.svg',
    abilities: [
      ...healerRoleActions('AST'),
      ab('AST.CollectiveUnconscious', 'Collective Unconscious', 60,  18, 'party', 10,  'aegis',  58, true,  '10% mit party 18s + Wheel of Fortune regen 100p/tick 8y'),
      ab('AST.NeutralSect',           'Neutral Sect',           120, 20, 'party', 10,  'star',   80, false, '+20% healing out + shield component on Aspected GCDs. Modelled as 10% party mit equivalent'),
      ab('AST.Exaltation',            'Exaltation',             60,  8,  'party', 10,  'shield', 86, true,  'Single ally 10% mit + 500p delayed heal'),
      ab('AST.CelestialOpposition',   'Celestial Opposition',   60,  15, 'heal',  0,   'cross',  60, true,  '200p instant + 100p regen 15s party'),
      ab('AST.EarthlyStar',           'Earthly Star',           60,  20, 'heal',  0,   'star',   62, true,  'Ground star: 540p at 10s, 720p at 20s detonate (manual)'),
      ab('AST.Macrocosmos',           'Macrocosmos',            180, 15, 'heal',  0,   'spark',  90, true,  'Compiles 50% of damage taken, restored via Microcosmos detonation'),
      ab('AST.Horoscope',             'Horoscope',              60,  10, 'heal',  0,   'cross',  76, true,  '200p delayed heal (400p if Helios cast during)'),
      ab('AST.LadyOfCrowns',          'Lady of Crowns',         1,   0,  'heal',  0,   'cross',  70, true,  '400p party heal. Requires Umbral Draw (gated by Astral Draw).'),
      ab('AST.SunSign',               'Sun Sign',               1,   15, 'party', 10,  'star',  100, true,  '10% mit party 15s. Requires Suntouched (from Neutral Sect).'),
    ],
  },
  {
    code: 'SGE', name: 'Sage', role: 'heal', sub_role: 'barrier_healer', position_order: 12,
    icon: '/icons/jobs/SGE.svg',
    abilities: [
      ...healerRoleActions('SGE'),
      ab('SGE.Kerachole',  'Kerachole',  30,  15, 'party',    10, 'soil',  50, true,  '10% mit party + 100p regen 15s. Costs 1 Addersgall.'),
      ab('SGE.Taurochole', 'Taurochole', 45,  15, 'party',    10, 'aegis', 62, true,  'Single ally 10% mit + 700p heal. Costs 1 Addersgall.'),
      ab('SGE.Physis',     'Physis II',  60,  15, 'heal',     0,  'cross', 60, true,  '130p regen party + 10% heal received'),
      ab('SGE.Haima',      'Haima',      120, 15, 'party',    10, 'aegis', 70, false, 'Single ally 5×300p shield stacks. Modelled as 10% party mit equivalent.'),
      ab('SGE.Holos',      'Holos',      120, 30, 'party',    10, 'aegis', 76, true,  '300p heal + 100% shield + 10% mit (mit lasts 20s)'),
      ab('SGE.Panhaima',   'Panhaima',   120, 15, 'party',    10, 'aegis', 80, false, 'Party 5×200p shield stacks. Modelled as 10% party mit equivalent.'),
      ab('SGE.Krasis',     'Krasis',     60,  10, 'party',    0,  'heart', 86, true,  '+20% heal received single ally'),
      ab('SGE.Pneuma',     'Pneuma',     120, 0,  'heal',     0,  'cross', 90, true,  '600p AoE heal party (line AoE damage on enemies too)'),
    ],
  },

  // ===== MELEE DPS =====
  {
    code: 'MNK', name: 'Monk', role: 'dps', sub_role: 'melee', position_order: 13,
    icon: '/icons/jobs/MNK.svg',
    abilities: [
      ...meleeRoleActions('MNK'),
      ab('MNK.Mantra',          'Mantra',           90,  15, 'heal',     0,  'star',     42, true, '+10% heal received party'),
      ab('MNK.RiddleOfEarth',   'Riddle of Earth',  120, 10, 'personal', 20, 'shield',   64, true, '20% mit + Earth\'s Resolve counter heal'),
    ],
  },
  {
    code: 'NIN', name: 'Ninja', role: 'dps', sub_role: 'melee', position_order: 14,
    icon: '/icons/jobs/NIN.svg',
    abilities: [
      ...meleeRoleActions('NIN'),
      ab('NIN.ShadeShift', 'Shade Shift', 120, 20, 'personal', 15, 'hex', 2, false, '20% maxHP damage absorption shield. Modelled as 15% personal mit equivalent.'),
    ],
  },
  {
    code: 'RPR', name: 'Reaper', role: 'dps', sub_role: 'melee', position_order: 15,
    icon: '/icons/jobs/RPR.svg',
    abilities: [
      ...meleeRoleActions('RPR'),
      ab('RPR.ArcaneCrest', 'Arcane Crest', 30, 5, 'personal', 10, 'hex', 40, false, '10% maxHP self shield + party heal trigger on break. Modelled as 10% personal mit equivalent.'),
    ],
  },
  {
    code: 'VPR', name: 'Viper', role: 'dps', sub_role: 'melee', position_order: 16,
    icon: '/icons/jobs/VPR.svg',
    abilities: [
      ...meleeRoleActions('VPR'),
      // No job-specific defensives in Dawntrail 7.5 — wiki confirmed.
    ],
  },

  // ===== PHYS RANGED =====
  {
    code: 'MCH', name: 'Machinist', role: 'dps', sub_role: 'phys_ranged', position_order: 17,
    icon: '/icons/jobs/MCH.svg',
    abilities: [
      ...physRangedRoleActions('MCH'),
      ab('MCH.Tactician',  'Tactician',  90,  15, 'party', 15, 'aegis',   56, true, '15% mit party (does not stack with Troubadour/Shield Samba)'),
      ab('MCH.Dismantle',  'Dismantle',  120, 10, 'party', 10, 'diamond', 62, true, 'Target enemy -10% damage dealt'),
    ],
  },
  {
    code: 'DNC', name: 'Dancer', role: 'dps', sub_role: 'phys_ranged', position_order: 18,
    icon: '/icons/jobs/DNC.svg',
    abilities: [
      ...physRangedRoleActions('DNC'),
      ab('DNC.ShieldSamba',   'Shield Samba',   90,  15, 'party', 15, 'aegis', 56, true, '15% mit party (does not stack with Troubadour/Tactician)'),
      ab('DNC.CuringWaltz',   'Curing Waltz',   60,  0,  'heal',  0,  'cross', 52, true, '300p instant party heal'),
      ab('DNC.Improvisation', 'Improvisation',  120, 15, 'heal',  0,  'note',  80, true, 'Channelled regen + 5-10% maxHP barrier on Improvised Finish'),
    ],
  },

  // ===== MAGIC RANGED =====
  {
    code: 'SMN', name: 'Summoner', role: 'dps', sub_role: 'magic_ranged', position_order: 19,
    icon: '/icons/jobs/SMN.svg',
    abilities: [
      ...casterRoleActions('SMN'),
      ab('SMN.RadiantAegis', 'Radiant Aegis', 60,  30, 'personal', 15, 'hex',   2,   false, '20% maxHP shield. 2 charges. Modelled as 15% personal mit equivalent.'),
      ab('SMN.Rekindle',     'Rekindle',      20,  30, 'heal',     0,  'cross', 80,  true,  '400p heal + 200p HoT trigger when HP<75%. Requires Firebird Trance.'),
      ab('SMN.LuxSolaris',   'Lux Solaris',   60,  0,  'heal',     0,  'cross', 100, true,  '500p party heal. Requires Refulgent Lux state.'),
    ],
  },
  {
    code: 'RDM', name: 'Red Mage', role: 'dps', sub_role: 'magic_ranged', position_order: 20,
    icon: '/icons/jobs/RDM.svg',
    abilities: [
      ...casterRoleActions('RDM'),
      ab('RDM.MagickBarrier', 'Magick Barrier', 120, 10, 'party', 10, 'aegis', 86, false, '10% magic mit + 5% heal-up party. Modelled as 10% party mit equivalent.'),
    ],
  },
  {
    code: 'PCT', name: 'Pictomancer', role: 'dps', sub_role: 'magic_ranged', position_order: 21,
    icon: '/icons/jobs/PCT.svg',
    abilities: [
      ...casterRoleActions('PCT'),
      ab('PCT.TemperaCoat',   'Tempera Coat',   120, 10, 'personal', 15, 'hex',  10, false, '20% maxHP self shield. Modelled as 15% personal mit equivalent.'),
      ab('PCT.TemperaGrassa', 'Tempera Grassa', 1,   10, 'party',    10, 'aegis',88, false, 'Extends Tempera Coat to party (gated by active Tempera Coat). Modelled as 10% party mit equivalent.'),
    ],
  },
];

// Attach _source_url to every ability of every new job.
for (const j of newJobs) {
  if (existingCodes.has(j.code)) {
    console.warn(`! ${j.code} already in seed — skipping`);
    continue;
  }
  for (const a of j.abilities) {
    a._source_url = wiki(j.name.replace(/ /g, '_'));
  }
}

const before = seed.jobs.length;
seed.jobs.push(...newJobs.filter((j) => !existingCodes.has(j.code)));
seed.updated_at = new Date().toISOString();

await writeFile(SEED_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');
console.log(`Added ${seed.jobs.length - before} jobs. Total: ${seed.jobs.length}.`);
console.log(`Total abilities: ${seed.jobs.reduce((s, j) => s + j.abilities.length, 0)}`);
