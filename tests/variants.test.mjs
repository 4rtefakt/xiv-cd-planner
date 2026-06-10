// Tests for the pure multi-pull variant helpers in web/src/lib/variants.ts.
// As with the other suites, we mirror the (tiny) pure functions here so
// `node --test` runs without a TS toolchain. Keep these in lockstep with
// the source — they encode the base→variant migration + active-mirror
// contract the whole multi-pull feature relies on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_VARIANT_ID = 'variant-1';
const DEFAULT_VARIANT_NAME = 'PULL #1';

const cloneMech = (m) => {
  const c = { ...m, targets: [...m.targets] };
  if (m.tags) c.tags = [...m.tags];
  return c;
};
const cloneUse = (u) => ({ ...u });

function syncActiveVariant(variants, activeId, mechanics, uses) {
  return variants.map((v) => (v.id === activeId ? { ...v, mechanics, uses } : v));
}
function singleVariant(mechanics, uses) {
  return {
    variants: [{ id: DEFAULT_VARIANT_ID, name: DEFAULT_VARIANT_NAME, mechanics, uses }],
    activeVariantId: DEFAULT_VARIANT_ID,
  };
}
function ensureVariants(mechanics, uses, variants) {
  if (variants && variants.length > 0) {
    return { variants, activeVariantId: variants[0].id };
  }
  return singleVariant(mechanics, uses);
}
function nextVariantName(variants) {
  let max = 0;
  for (const v of variants) {
    const m = v.name.match(/#(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PULL #${Math.max(max + 1, variants.length + 1)}`;
}
function duplicateVariant(source, id, name) {
  return { id, name, mechanics: source.mechanics.map(cloneMech), uses: source.uses.map(cloneUse) };
}

const mech = (id, time) => ({ id, lane_id: 'lane-1', name: id, time, category: 'damage', targets: ['p1'] });
const use = (id, time) => ({ id, player_id: 'p1', ability_id: 'PLD.Rampart', time });

test('ensureVariants migrates a legacy plan (no variants) into PULL #1', () => {
  const mechs = [mech('m1', 10)];
  const uses = [use('u1', 8)];
  const { variants, activeVariantId } = ensureVariants(mechs, uses, undefined);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].id, DEFAULT_VARIANT_ID);
  assert.equal(variants[0].name, 'PULL #1');
  assert.equal(activeVariantId, DEFAULT_VARIANT_ID);
  // The legacy top-level data lands inside the synthesized variant.
  assert.deepEqual(variants[0].mechanics, mechs);
  assert.deepEqual(variants[0].uses, uses);
});

test('ensureVariants treats an existing variants[] as source of truth, first = active', () => {
  const stored = [
    { id: 'v-a', name: 'A', mechanics: [mech('m1', 1)], uses: [] },
    { id: 'v-b', name: 'B', mechanics: [], uses: [use('u1', 2)] },
  ];
  // Top-level mechanics/uses passed in are IGNORED when variants exist —
  // they'd be a stale active-at-save mirror.
  const { variants, activeVariantId } = ensureVariants([mech('stale', 9)], [], stored);
  assert.equal(variants, stored);
  assert.equal(activeVariantId, 'v-a');
});

test('syncActiveVariant writes the live top-level data back into the active entry only', () => {
  const variants = [
    { id: 'v-a', name: 'A', mechanics: [], uses: [] },
    { id: 'v-b', name: 'B', mechanics: [mech('mb', 5)], uses: [] },
  ];
  const liveMechs = [mech('m-live', 3)];
  const liveUses = [use('u-live', 3)];
  const out = syncActiveVariant(variants, 'v-a', liveMechs, liveUses);
  assert.deepEqual(out[0].mechanics, liveMechs);
  assert.deepEqual(out[0].uses, liveUses);
  // The inactive variant is untouched (same reference).
  assert.equal(out[1], variants[1]);
});

test('nextVariantName is one past the highest #n, surviving deletions', () => {
  assert.equal(nextVariantName([{ name: 'PULL #1' }]), 'PULL #2');
  // #2 deleted, #1 and #3 remain → next is #4, not #3 (no collision).
  assert.equal(nextVariantName([{ name: 'PULL #1' }, { name: 'PULL #3' }]), 'PULL #4');
  // All renamed to non-numbered labels → floor of count+1.
  assert.equal(nextVariantName([{ name: 'Adds NE' }, { name: 'Adds NW' }]), 'PULL #3');
});

test('duplicateVariant deep-clones mechanics/uses under a new id + name', () => {
  const source = { id: 'v-a', name: 'A', mechanics: [mech('m1', 1)], uses: [use('u1', 1)] };
  const dup = duplicateVariant(source, 'v-new', 'PULL #2');
  assert.equal(dup.id, 'v-new');
  assert.equal(dup.name, 'PULL #2');
  assert.deepEqual(dup.mechanics, source.mechanics);
  // Mutating the clone must not leak into the source (no shared refs).
  dup.mechanics[0].targets.push('p2');
  assert.deepEqual(source.mechanics[0].targets, ['p1']);
});
