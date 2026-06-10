import { useEffect } from 'react';
import { api } from '../api/client';
import { usePlanStore } from '../state/planStore';
import { resetHistory } from '../state/historyManager';

const SLUG_RE = /^\/p\/([\w-]+)$/;

/**
 * On mount, parse window.location.pathname. If it matches /p/:slug,
 * fetch the plan and hydrate the store. Otherwise leave the default
 * empty state in place — the first user edit will POST a fresh plan
 * via AutoSaver and rewrite the URL.
 *
 * Renders nothing.
 */
export function PlanLoader() {
  const hydratePlan = usePlanStore((s) => s.hydratePlan);
  const setSaveStatus = usePlanStore((s) => s.setSaveStatus);
  const setReadOnly = usePlanStore((s) => s.setReadOnly);

  useEffect(() => {
    // Read-only mode is opt-in via the query string : /p/<slug>?view=read
    // applies BEFORE the fetch so AutoSaver never wakes up for this load.
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'read') setReadOnly(true);

    const match = window.location.pathname.match(SLUG_RE);
    if (!match) return;
    const slug = match[1]!;

    let cancelled = false;
    setSaveStatus('saving'); // suppress AutoSaver during hydrate
    api
      .getPlan(slug)
      .then((plan) => {
        if (cancelled) return;
        hydratePlan({
          meta: { slug },
          encounter: plan.encounter,
          party: plan.party,
          boss_lanes: plan.boss_lanes,
          mechanics: plan.mechanics,
          uses: plan.uses,
          // These two were missing → hidden abilities silently came
          // back (and phases would vanish) on every page reload.
          hidden_ability_ids: plan.hidden_ability_ids,
          phases: plan.phases,
          variants: plan.variants,
        });
        // Wipe the in-memory history baseline so Ctrl+Z after a fresh
        // load can't revert the user to the empty-default party.
        resetHistory();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[PlanLoader] failed to load', slug, err);
        // 404 or transport error — strip the bad path so AutoSaver can
        // POST a fresh plan after the user's first edit.
        window.history.replaceState({}, '', '/');
        setSaveStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [hydratePlan, setSaveStatus, setReadOnly]);

  return null;
}
