import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { usePlanStore } from '../state/planStore';

/** Save debounce — 1s after the last edit. Tuned to feel "immediate"
 *  without hammering the API on every click during chained edits. */
const DEBOUNCE_MS = 1000;

/**
 * Background auto-save daemon.
 *
 * Subscribes to the slices that should be persisted (encounter, party,
 * boss lanes, mechanics, uses) and runs a debounced API call:
 *   - No slug yet → POST /api/plans, capture the returned slug, push
 *     /p/:slug into the URL with history.replaceState
 *   - Existing slug → PATCH /api/plans/:slug
 *
 * Skips:
 *   - The very first effect run on mount (no user mutation yet, the
 *     defaults are baseline state, not something worth saving)
 *   - Effect runs that happen while loadingFromServer is true (during
 *     a plan hydrate the slices change but it's not a user edit)
 *
 * Renders nothing — mount once near the App root.
 */
export function AutoSaver() {
  const encounter = usePlanStore((s) => s.encounter);
  const party = usePlanStore((s) => s.party);
  const bossLanes = usePlanStore((s) => s.bossLanes);
  const mechanics = usePlanStore((s) => s.mechanics);
  const uses = usePlanStore((s) => s.uses);
  const hiddenAbilityIds = usePlanStore((s) => s.hiddenAbilityIds);
  const phases = usePlanStore((s) => s.phases);

  // Refs that don't trigger re-renders.
  const isFirstEffect = useRef(true);
  const inFlight = useRef<number | null>(null);

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false;
      return;
    }
    // hydratePlan flips this when loading from server. Consume the flag
    // and skip this effect run — the slices changed, but it wasn't a
    // user edit so there's nothing to push back.
    if (usePlanStore.getState()._skipNextSave) {
      usePlanStore.setState({ _skipNextSave: false });
      return;
    }
    if (inFlight.current) window.clearTimeout(inFlight.current);

    inFlight.current = window.setTimeout(async () => {
      const state = usePlanStore.getState();
      // Don't try to save while a plan is still being hydrated from the
      // server — the slice mutations during hydrate would otherwise
      // bounce back as a needless PATCH.
      if (state.saveStatus === 'saving') return;
      // Read-only view : never POST or PATCH.
      if (state.readOnly) return;
      state.setSaveStatus('saving');

      const body = {
        encounter: state.encounter,
        party: state.party,
        boss_lanes: state.bossLanes,
        mechanics: state.mechanics,
        uses: state.uses,
        hidden_ability_ids: state.hiddenAbilityIds,
        phases: state.phases,
      };
      try {
        if (!state.slug) {
          const res = await api.createPlan(body);
          state.setSlug(res.slug);
          window.history.replaceState({}, '', `/p/${res.slug}`);
        } else {
          await api.patchPlan(state.slug, body);
        }
        state.setSaveStatus('saved');
      } catch (err) {
        console.error('[AutoSaver] failed', err);
        state.setSaveStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (inFlight.current) window.clearTimeout(inFlight.current);
    };
  }, [encounter, party, bossLanes, mechanics, uses, hiddenAbilityIds, phases]);

  return null;
}
