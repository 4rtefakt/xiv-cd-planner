/**
 * Coverage calculation for a single mechanic.
 *
 * Simplifications for the MVP (per bootstrap spec):
 *   - additive mit stacking (not multiplicative) capped at 85%
 *   - no separation between physical/magic damage
 *   - 'expected' values per mech type are coarse defaults
 *
 * Real FFXIV multiplicative formulas land later as a refinement.
 */

import type { Ability, DamageKind, MechType, Mechanic, Use } from '../types';

export type CoverageTier = 'bad' | 'warn' | 'good' | 'pure' | 'none';

export interface Coverage {
  pct: number;       // sum of active ability mit_potency, capped at 85
  tier: CoverageTier;
  expected: number;  // baseline used to decide the tier
  pure: boolean;     // true when the mechanic is pure damage (mit ignored)
  /** True when there is nothing to mitigate (placement mechs). */
  placement: boolean;
}

/**
 * Derive a visual MechType from the new (category, targets) shape so the
 * existing color tokens keep working without forcing users to pick a
 * "raidwide / tankbuster / custom" label themselves.
 */
export function deriveMechType(mech: Pick<Mechanic, 'category' | 'targets'>, partySize: number): MechType {
  if (mech.category === 'placement') return 'custom';
  if (mech.targets.length === 0) return 'custom';
  if (mech.targets.length >= partySize) return 'raidwide';
  if (mech.targets.length === 1) return 'tankbuster';
  return 'custom';
}

const EXPECTED_MIT_BY_TYPE: Record<MechType, number> = {
  raidwide: 80,
  tankbuster: 70,
  autos: 40,
  custom: 60,
};

const COVERAGE_CAP = 85;

/** Does this ability apply against the given damage kind? Abilities
 *  without a mit_kind ('all' implicit) work against both physical and
 *  magical. Magic-only abilities don't help a phys raidwide, etc. */
function abilityMitigates(ab: Ability, kind: DamageKind): boolean {
  if (kind === 'pure') return false;
  const mk = ab.mit_kind ?? 'all';
  if (mk === 'all') return true;
  return mk === kind;
}

/**
 * Hypothetical use, supplied to computeCoverage to simulate placing or
 * moving a CdUse without mutating the real uses[] yet. Used for the
 * live "→ NEW%" badge the user sees while hovering a placement.
 */
export interface SimulatedUse {
  ability_id: string;
  time: number;
  /** When set, exclude this use from the base set before adding the
   *  simulated one. Used for reposition drags so the user doesn't
   *  double-count their own contribution at the old timestamp. */
  exclude_use_id?: string;
}

export function computeCoverage(
  mech: Mechanic,
  uses: Use[],
  abilities: Map<string, Ability>,
  partySize: number,
  simulated?: SimulatedUse,
): Coverage {
  // Placement mechs are informational only — no damage to mitigate.
  if (mech.category === 'placement') {
    return { pct: 0, tier: 'none', expected: 0, pure: false, placement: true };
  }
  const kind: DamageKind = mech.damage_kind ?? 'magical';
  if (kind === 'pure') {
    return { pct: 0, tier: 'pure', expected: 0, pure: true, placement: false };
  }
  let total = 0;
  for (const u of uses) {
    if (simulated?.exclude_use_id === u.id) continue;
    const ab = abilities.get(u.ability_id);
    if (!ab) continue;
    if (mech.time < u.time || mech.time >= u.time + ab.effect) continue;
    if (!abilityMitigates(ab, kind)) continue;
    total += ab.mit_potency;
  }
  if (simulated) {
    const ab = abilities.get(simulated.ability_id);
    if (ab && mech.time >= simulated.time && mech.time < simulated.time + ab.effect && abilityMitigates(ab, kind)) {
      total += ab.mit_potency;
    }
  }
  const pct = Math.min(COVERAGE_CAP, total);
  const visualType = deriveMechType(mech, partySize);
  const expected = EXPECTED_MIT_BY_TYPE[visualType];
  const ratio = expected > 0 ? pct / expected : 0;
  const tier: CoverageTier = ratio < 0.4 ? 'bad' : ratio < 0.75 ? 'warn' : 'good';
  return { pct, tier, expected, pure: false, placement: false };
}

/** Flatten all abilities across all jobs into a single id→Ability map. */
export function abilityIndex(jobs: { abilities: Ability[] }[]): Map<string, Ability> {
  const map = new Map<string, Ability>();
  for (const job of jobs) {
    for (const ab of job.abilities) map.set(ab.id, ab);
  }
  return map;
}

/**
 * Two CdUse windows on the same player + ability cannot overlap their
 * recast cycles — once you cast it, you wait the full recast before the
 * next one. Returns the conflicting Use (if any) so callers can render
 * a specific rejection hint.
 *
 * `excludeUseId` lets callers skip the use being moved (so dragging a
 * use slightly doesn't self-conflict).
 */
export function findUseConflict(
  playerId: string,
  abilityId: string,
  time: number,
  recast: number,
  uses: Use[],
  excludeUseId?: string,
): Use | null {
  const start = time;
  const end = time + recast;
  for (const u of uses) {
    if (excludeUseId && u.id === excludeUseId) continue;
    if (u.player_id !== playerId || u.ability_id !== abilityId) continue;
    const uEnd = u.time + recast;
    if (start < uEnd && u.time < end) return u;
  }
  return null;
}
