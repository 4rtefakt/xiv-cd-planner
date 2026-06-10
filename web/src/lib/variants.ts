/**
 * Pure helpers for the multi-pull "variants" feature — increment 1
 * (full-copy variants, see docs/design/multi-pull.md).
 *
 * Design : the plan's top-level `mechanics`/`uses` ALWAYS mirror the
 * ACTIVE variant ; `variants[]` is the source of truth. These helpers
 * keep the two reconciled at the persistence / history / switch
 * boundaries, so the existing CRUD actions (addMechanic, moveUse, …)
 * never have to learn about variants — they keep mutating top-level as
 * before, and we re-sync the active entry lazily.
 */

import type { Mechanic, PullVariant, Use } from '../types';

const DEFAULT_VARIANT_ID = 'variant-1';
const DEFAULT_VARIANT_NAME = 'PULL #1';

function cloneMech(m: Mechanic): Mechanic {
  const c: Mechanic = { ...m, targets: [...m.targets] };
  if (m.tags) c.tags = [...m.tags];
  return c;
}
function cloneUse(u: Use): Use {
  return { ...u };
}

/**
 * Return `variants` with the active entry's mechanics/uses replaced by
 * the live top-level arrays. Used right before persisting, snapshotting
 * for undo, or switching away from the active variant.
 */
export function syncActiveVariant(
  variants: PullVariant[],
  activeId: string,
  mechanics: Mechanic[],
  uses: Use[],
): PullVariant[] {
  return variants.map((v) => (v.id === activeId ? { ...v, mechanics, uses } : v));
}

/**
 * Normalize a (possibly legacy) plan into a non-empty variants list plus
 * the active variant id. Legacy plans (no `variants`) are migrated into a
 * single "PULL #1" variant carrying their existing mechanics/uses — the
 * same backfill pattern as `phases`. When `variants` is present and
 * non-empty it's the source of truth and the first entry becomes active.
 */
export function ensureVariants(
  mechanics: Mechanic[],
  uses: Use[],
  variants?: PullVariant[],
): { variants: PullVariant[]; activeVariantId: string } {
  if (variants && variants.length > 0) {
    return { variants, activeVariantId: variants[0].id };
  }
  return singleVariant(mechanics, uses);
}

/** A fresh single-variant list — used by reset / log-import flows. */
export function singleVariant(
  mechanics: Mechanic[],
  uses: Use[],
): { variants: PullVariant[]; activeVariantId: string } {
  return {
    variants: [{ id: DEFAULT_VARIANT_ID, name: DEFAULT_VARIANT_NAME, mechanics, uses }],
    activeVariantId: DEFAULT_VARIANT_ID,
  };
}

/**
 * Next default pull name : one past the highest "PULL #n" already used
 * (so deleting #2 then adding back doesn't collide), with a floor of
 * count + 1 in case the user renamed everything to non-numbered labels.
 */
export function nextVariantName(variants: PullVariant[]): string {
  let max = 0;
  for (const v of variants) {
    const m = v.name.match(/#(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PULL #${Math.max(max + 1, variants.length + 1)}`;
}

/** Deep clone a variant under a new id + name (the "+ PULL" duplicate). */
export function duplicateVariant(source: PullVariant, id: string, name: string): PullVariant {
  return {
    id,
    name,
    mechanics: source.mechanics.map(cloneMech),
    uses: source.uses.map(cloneUse),
  };
}
