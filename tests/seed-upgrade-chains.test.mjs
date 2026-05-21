// Regression test for the player-ability upgrade chains modelled via
// `level_variants` in seed/data.json. We re-implement the resolver here
// (it's a pure ~10-line function) to keep the test runnable with bare
// `node --test`, with no TS/Vite bundler in the loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  readFileSync(join(__dirname, '..', 'seed', 'data.json'), 'utf8'),
);

function resolveAbilityAtLevel(ab, level) {
  if (!ab.level_variants) return ab;
  const keys = Object.keys(ab.level_variants)
    .map(Number)
    .filter((k) => Number.isFinite(k) && k <= level)
    .sort((a, b) => a - b);
  if (keys.length === 0) return ab;
  let merged = { ...ab };
  for (const k of keys) {
    const patch = ab.level_variants[k];
    if (patch) merged = { ...merged, ...patch };
  }
  delete merged.level_variants;
  return merged;
}

function findAbility(jobCode, abilityId) {
  const job = seed.jobs.find((j) => j.code === jobCode);
  return job?.abilities.find((a) => a.id === abilityId);
}

test('PLD.DivineCaress is not duplicated in PLD (Divine Caress is WHM-only)', () => {
  const pld = seed.jobs.find((j) => j.code === 'PLD');
  assert.ok(pld);
  assert.equal(
    pld.abilities.find((a) => a.id === 'PLD.DivineCaress'),
    undefined,
  );
  // The WHM entry must still be present.
  const whm = seed.jobs.find((j) => j.code === 'WHM');
  assert.ok(whm.abilities.find((a) => a.id === 'WHM.DivineCaress'));
});

test('Upgrade chains resolve to the pre-form below the upgrade level', () => {
  const cases = [
    { id: 'PLD.Sentinel', job: 'PLD', preLvl: 38, upLvl: 92, preName: 'Sentinel', upName: 'Guardian' },
    { id: 'PLD.Sheltron', job: 'PLD', preLvl: 35, upLvl: 82, preName: 'Sheltron', upName: 'Holy Sheltron' },
    { id: 'WAR.Vengeance', job: 'WAR', preLvl: 38, upLvl: 92, preName: 'Vengeance', upName: 'Damnation' },
    { id: 'WAR.Bloodwhetting', job: 'WAR', preLvl: 56, upLvl: 82, preName: 'Raw Intuition', upName: 'Bloodwhetting' },
    { id: 'DRK.ShadowedVigil', job: 'DRK', preLvl: 38, upLvl: 92, preName: 'Shadow Wall', upName: 'Shadowed Vigil' },
    { id: 'GNB.GreatNebula', job: 'GNB', preLvl: 38, upLvl: 92, preName: 'Nebula', upName: 'Great Nebula' },
    { id: 'GNB.HeartOfCorundum', job: 'GNB', preLvl: 68, upLvl: 82, preName: 'Heart of Stone', upName: 'Heart of Corundum' },
    { id: 'SAM.ThirdEye', job: 'SAM', preLvl: 6, upLvl: 82, preName: 'Third Eye', upName: 'Tengentsu' },
    { id: 'SGE.Physis', job: 'SGE', preLvl: 20, upLvl: 60, preName: 'Physis', upName: 'Physis II' },
  ];

  for (const c of cases) {
    const ab = findAbility(c.job, c.id);
    assert.ok(ab, `seed must contain ${c.id}`);
    assert.equal(ab.level_unlocked, c.preLvl, `${c.id}: level_unlocked must match pre-form unlock`);

    // Just before upgrade level → pre-form
    const below = resolveAbilityAtLevel(ab, c.upLvl - 1);
    assert.equal(below.name, c.preName, `${c.id}: lvl ${c.upLvl - 1} name`);

    // At and above upgrade level → upgraded form
    const above = resolveAbilityAtLevel(ab, c.upLvl);
    assert.equal(above.name, c.upName, `${c.id}: lvl ${c.upLvl} name`);
    const max = resolveAbilityAtLevel(ab, 100);
    assert.equal(max.name, c.upName, `${c.id}: lvl 100 name`);
  }
});

test('Lvl-92 tank upgrades give 30% mit pre-upgrade and 40% at/after lvl 92', () => {
  const ids = ['PLD.Sentinel', 'WAR.Vengeance', 'DRK.ShadowedVigil', 'GNB.GreatNebula'];
  for (const id of ids) {
    const [jobCode] = id.split('.');
    const ab = findAbility(jobCode, id);
    assert.ok(ab);
    assert.equal(resolveAbilityAtLevel(ab, 91).mit_potency, 30, `${id} @ lvl 91`);
    assert.equal(resolveAbilityAtLevel(ab, 92).mit_potency, 40, `${id} @ lvl 92`);
    assert.equal(resolveAbilityAtLevel(ab, 100).mit_potency, 40, `${id} @ lvl 100`);
  }
});
