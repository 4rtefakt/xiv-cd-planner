import type { Env, Job } from '../_types';
import { json, jsonErr } from '../_lib';

interface JobsDoc {
  version: number;
  updated_at: string | null;
  jobs: Job[];
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const raw = await ctx.env.JOBS_KV.get('jobs:all');
  if (!raw) return jsonErr(404, 'not_seeded', 'JOBS_KV[jobs:all] is empty — run scripts/seed-kv.mjs');

  const doc = JSON.parse(raw) as JobsDoc;
  return json({ version: doc.version, updated_at: doc.updated_at, jobs: doc.jobs });
};
