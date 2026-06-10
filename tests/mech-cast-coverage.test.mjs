// Guards the coverage rule for the 'cast' mech category. Boss casts
// imported from the FFLogs "sorts" tab carry no damage_kind (cast and
// damage are distinct FFLogs objects), so they must count as
// non-mitigable — exactly like a placement — and never drag the
// coverage % down even when a defensive is active over them.
//
// Mirrors the early-return branching of computeCoverage in
// web/src/lib/mitigation.ts (re-implemented here so node:test runs
// without a TS toolchain, same approach as mech-render.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const CAP = 85;

function computeCoverage(mech, uses, abilities) {
  // Placement mechs and boss casts are informational only.
  if (mech.category === 'placement' || mech.category === 'cast') {
    return { pct: 0, pure: false, placement: true };
  }
  const kind = mech.damage_kind ?? 'magical';
  if (kind === 'pure') return { pct: 0, pure: true, placement: false };
  let total = 0;
  for (const u of uses) {
    const ab = abilities.get(u.ability_id);
    if (!ab) continue;
    if (mech.time < u.time || mech.time >= u.time + ab.effect) continue;
    total += ab.mit_potency;
  }
  return { pct: Math.min(CAP, total), pure: false, placement: false };
}

const abilities = new Map([
  ['REPRISAL', { effect: 15, mit_potency: 10 }],
]);
// A use that fully overlaps a mech at t=20.
const uses = [{ ability_id: 'REPRISAL', time: 18 }];

test('cast mech is non-mitigable regardless of active defensives', () => {
  const cast = { category: 'cast', time: 20 };
  const cov = computeCoverage(cast, uses, abilities);
  assert.equal(cov.placement, true);
  assert.equal(cov.pct, 0);
  assert.equal(cov.pure, false);
});

test('placement still behaves the same as cast (regression guard)', () => {
  const placement = { category: 'placement', time: 20 };
  assert.deepEqual(
    computeCoverage(placement, uses, abilities),
    computeCoverage({ category: 'cast', time: 20 }, uses, abilities),
  );
});

test('a damage mech under the same use DOES count (control)', () => {
  const dmg = { category: 'damage', damage_kind: 'magical', time: 20 };
  const cov = computeCoverage(dmg, uses, abilities);
  assert.equal(cov.pct, 10);
  assert.equal(cov.placement, false);
});
