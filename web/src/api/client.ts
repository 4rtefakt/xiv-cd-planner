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
  time: number;
  targetNames: string[];
  damage_kind: 'physical' | 'magical' | 'pure';
  sample_amount: number;
  /** Display name of the source NPC that cast the mech (Shinryu, Right
   *  Wing, Adds, …). Used to assign mechs to the right boss lane. */
  source_name?: string;
}

export interface FFLogsFightData {
  fightName: string;
  fightStart: number;
  fightEnd: number;
  fightDuration: number;
  /** Ordered list of boss lane names — Boss subtype first, then by
   *  event count desc. Frontend creates one BossLane per entry. */
  bossLanes: string[];
  mechanics: FFLogsMechanic[];
}

export const api = {
  health(): Promise<{ ok: boolean; env: string; time: string }> {
    return req('/health');
  },
  fflogsReport(codeOrUrl: string): Promise<FFLogsReport> {
    return req(`/fflogs/report/${encodeURIComponent(codeOrUrl)}`);
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
