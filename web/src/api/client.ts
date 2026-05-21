import type { Job, Plan } from '../types';

const API = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body || path}`);
  }
  return (await res.json()) as T;
}

export interface JobsResponse {
  version: number;
  updated_at: string | null;
  jobs: Job[];
}

export interface FFLogsFight {
  id: number;
  name: string;
  encounterID: number;
  startTime: number;
  endTime: number;
  duration: number;
  kill: boolean;
  difficulty: number | null;
  fightPercentage: number | null;
}

export interface FFLogsReport {
  code: string;
  title: string;
  owner: string | null;
  startTime: number;
  endTime: number;
  fights: FFLogsFight[];
}

export interface FFLogsMechanic {
  name: string;
  /** French translation of `name`, resolved server-side via xivapi using
   *  `game_id`. Absent when xivapi didn't return a translation or when
   *  game_id is unknown (rare). */
  name_fr?: string;
  /** xivapi action id (= FFLogs abilityGameID). Kept on the imported
   *  Mechanic so the client can lazily resolve a FR translation later
   *  if needed. */
  game_id?: number;
  time: number;
  targetNames: string[];
  damage_kind: 'physical' | 'magical' | 'pure';
  sample_amount: number;
  /** Display name of the source NPC that cast the mech (Shinryu, Right
   *  Wing, Adds, …). Used to assign mechs to the right boss lane. */
  source_name?: string;
  /** Number of FFLogs damage events that collapsed into this mech. */
  hit_count?: number;
  /** Boss cast time in seconds, recovered from begincast→cast pairing
   *  on the server. Absent for instant mechs. */
  cast_time?: number;
}

export interface FFLogsPlayer {
  name: string;
  /** Raw FFLogs subType (Paladin, WhiteMage, BlackMage, …). The
   *  importer maps it to our job codes (PLD, WHM, BLM). */
  subType: string;
}

export interface FFLogsPlayerUse {
  /** Player display name — matched against `FFLogsPlayer.name` to find
   *  the corresponding player_id in the freshly-built party. */
  playerName: string;
  /** xivapi/FFLogs action id — looked up against the seed's
   *  `ability.action_id` to recover the ability row. */
  actionId: number;
  /** Seconds since fight start. */
  time: number;
}

export interface FFLogsFightData {
  fightName: string;
  fightStart: number;
  fightEnd: number;
  fightDuration: number;
  /** Synced/max player level inferred from the report's expansion id.
   *  null = couldn't determine (older expansions or unknown zone) ; the
   *  client falls back to its current encounter.level. */
  gameLevel: number | null;
  /** Ordered list of boss lane names — Boss subtype first, then by
   *  event count desc. Frontend creates one BossLane per entry. */
  bossLanes: string[];
  /** Player roster pulled from the report's master data. */
  players: FFLogsPlayer[];
  mechanics: FFLogsMechanic[];
  /** All confirmed friendly cast events from the fight. The client
   *  filters down to those whose actionId matches an ability in our
   *  seed and rebuilds `uses[]`. */
  playerUses?: FFLogsPlayerUse[];
}

/**
 * Extract an FFLogs report code from any form the user might paste :
 *   - bare code       : "1bf2JXRCLvA9cgMD"
 *   - report URL      : "https://www.fflogs.com/reports/1bf2JXRCLvA9cgMD"
 *   - URL with query  : "…/reports/1bf2JXRCLvA9cgMD?fight=last&type=damage-done"
 *   - URL with hash   : "…/reports/1bf2JXRCLvA9cgMD#fight=12"
 *   - regional subdomain : "https://fr.fflogs.com/reports/abc123"
 * Returns null when nothing report-shaped is found.
 */
export function extractReportCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]{12,24}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/\/reports\/([a-zA-Z0-9]{8,32})/);
  return m ? m[1]! : null;
}

export const api = {
  health(): Promise<{ ok: boolean; env: string; time: string }> {
    return req('/health');
  },
  fflogsReport(codeOrUrl: string): Promise<FFLogsReport> {
    const code = extractReportCode(codeOrUrl);
    if (!code) {
      return Promise.reject(
        new Error(
          'Pasted text doesn\'t look like an FFLogs URL or report code. Expected something like https://www.fflogs.com/reports/abcDEF123 or a 12-20 char code.',
        ),
      );
    }
    return req(`/fflogs/report/${code}`);
  },
  fflogsFight(code: string, fightId: number): Promise<FFLogsFightData> {
    return req('/fflogs/fight', { method: 'POST', body: JSON.stringify({ code, fightId }) });
  },
  jobs(): Promise<JobsResponse> {
    return req('/jobs');
  },
  createPlan(body: Partial<Plan> = {}): Promise<{ slug: string; plan: Plan }> {
    return req('/plans', { method: 'POST', body: JSON.stringify(body) });
  },
  getPlan(slug: string): Promise<Plan> {
    return req(`/plans/${slug}`);
  },
  patchPlan(slug: string, patch: Partial<Plan>): Promise<{ ok: boolean; plan: Plan }> {
    return req(`/plans/${slug}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  deletePlan(slug: string): Promise<{ ok: boolean }> {
    return req(`/plans/${slug}`, { method: 'DELETE' });
  },
};
