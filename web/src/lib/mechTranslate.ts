/**
 * Lazy FR translation of imported mechanics.
 *
 * FFLogs returns ability names in English only. When the planner UI is
 * in French AND a mechanic still has only its English name AND we know
 * its xivapi action id (game_id, set at import time), we fetch the FR
 * Name from xivapi once and patch the mechanic in the store via
 * `updateMechanic`. The plan auto-saver will then persist `name_fr`.
 *
 * Caching strategy :
 *   - `inflight` blocks duplicate fetches for the same game_id while
 *     the request is open.
 *   - `cache` stores the resolved FR name (or null = no translation
 *     available) so we don't re-query on remount.
 *   - Both are module-level Maps — the cache survives across mechs but
 *     not across full reloads, which is fine (xivapi is fast and the
 *     server-side enrichment covers new imports).
 *
 * Failure mode : if xivapi returns no FR name or the request errors,
 * we cache `null` and the mech keeps its EN name. Silent so the user's
 * timeline isn't disrupted by network hiccups.
 */

import { useEffect } from 'react';
import type { Mechanic } from '../types';
import type { Lang } from '../i18n';

const cache = new Map<number, string | null>();
const inflight = new Map<number, Promise<string | null>>();

async function fetchFrName(gameId: number): Promise<string | null> {
  const cached = cache.get(gameId);
  if (cached !== undefined) return cached;
  const pending = inflight.get(gameId);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`https://xivapi.com/action/${gameId}?columns=Name_fr`);
      if (!res.ok) return null;
      const j = (await res.json()) as { Name_fr?: string };
      const name = j.Name_fr && j.Name_fr.trim().length > 0 ? j.Name_fr : null;
      cache.set(gameId, name);
      return name;
    } catch {
      cache.set(gameId, null);
      return null;
    } finally {
      inflight.delete(gameId);
    }
  })();
  inflight.set(gameId, p);
  return p;
}

/**
 * Hook : when lang === 'fr' and the mech still needs a FR name (has a
 * game_id but no name_fr), fetch and patch. No-op in EN and for fresh
 * imports that already carry name_fr from the server.
 */
export function useLazyFrName(
  mech: Mechanic,
  lang: Lang,
  updateMechanic: (id: string, patch: Partial<Mechanic>) => void,
): void {
  useEffect(() => {
    if (lang !== 'fr') return;
    if (mech.name_fr) return;
    if (mech.game_id == null) return;
    let cancelled = false;
    fetchFrName(mech.game_id).then((name) => {
      if (cancelled || !name) return;
      // Match the import flow's uppercase convention so the label
      // doesn't visually flicker between cases on first FR resolve.
      updateMechanic(mech.id, { name_fr: name.toUpperCase() });
    });
    return () => {
      cancelled = true;
    };
  }, [mech.id, mech.game_id, mech.name_fr, lang, updateMechanic]);
}
