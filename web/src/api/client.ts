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

export const api = {
  health(): Promise<{ ok: boolean; env: string; time: string }> {
    return req('/health');
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
