/**
 * resolveAbilityAtLevel : merge an ability's base values with the
 * narrowest applicable level_variants bracket for `level`.
 *
 * Mental model :
 *   - Base values in the ability are the MAX-level reference (lvl 100).
 *   - `level_variants` keys are sorted ascending : 50, 60, 70, …, 100.
 *   - We pick every bracket key ≤ level and merge them in ascending
 *     order (lower brackets first, higher overwrite lower keys).
 *     So `{ 70: { mit_potency: 25 }, 90: { mit_potency: 30 } }` at
 *     lvl 70 → 25%, at lvl 90 → 30%, at lvl 100 → falls back to base.
 *
 * Example : Bloodwhetting (WAR) doesn't exist until lvl82 → the base
 * value is the lvl100 version. At lvl70 the ability is filtered out
 * entirely (level_unlocked > level) and never resolves.
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
