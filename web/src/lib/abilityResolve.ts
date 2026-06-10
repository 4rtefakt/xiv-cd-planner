/**
 * resolveAbilityAtLevel : merge an ability's base values with every
 * level_variants patch whose key is ≤ `level`.
 *
 * Mental model (matches the authoring convention in seed/data.json) :
 *   - Base fields describe the ability's LOWEST-level form — what a
 *     player has right at level_unlocked.
 *   - Each `level_variants` key is the level where a trait or action
 *     upgrade kicks in ; its patch applies from that level UPWARD.
 *   - Keys ≤ level merge in ascending order (higher keys overwrite
 *     lower ones), so chained upgrades compose naturally.
 *     e.g. Reprisal `{ 98: { effect: 15 } }` → 10s below 98, 15s after.
 *     e.g. Sheltron `{ 82: { name: 'Holy Sheltron', … } }` → the whole
 *     identity (name, icon, action_id, stats) swaps at 82.
 *
 * The returned object is a fresh shallow copy ; callers can read fields
 * without worrying about mutating the seed.
 */

import type { Ability } from '../types';

export function resolveAbilityAtLevel(ab: Ability, level: number): Ability {
  if (!ab.level_variants) return ab;
  const keys = Object.keys(ab.level_variants)
    .map((k) => Number(k))
    .filter((k) => Number.isFinite(k) && k <= level)
    .sort((a, b) => a - b);
  if (keys.length === 0) return ab;
  let merged: Ability = { ...ab };
  for (const k of keys) {
    const patch = ab.level_variants[k];
    if (patch) merged = { ...merged, ...patch } as Ability;
  }
  // The variants themselves shouldn't survive on the resolved object —
  // they're an internal detail of the source data and confuse consumers.
  delete (merged as { level_variants?: unknown }).level_variants;
  return merged;
}

/**
 * Resolve every ability in a Job array at `level`. Used to build a
 * level-aware ability index for coverage calc + display.
 */
export function resolveJobAbilitiesAtLevel(
  abilities: Ability[],
  level: number,
): Ability[] {
  return abilities.map((ab) => resolveAbilityAtLevel(ab, level));
}
