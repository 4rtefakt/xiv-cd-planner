import type { Env, Job } from '../../../_types';
import { json, jsonErr } from '../../../_lib';

interface JobsDoc {
  version: number;
  jobs: Job[];
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = String(ctx.params.code ?? '').toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) {
    return jsonErr(400, 'bad_request', 'code must be a 3-letter job code (e.g. PLD)');
  }

  const raw = await ctx.env.JOBS_KV.get('jobs:all');
  if (!raw) return jsonErr(404, 'not_seeded', 'JOBS_KV[jobs:all] is empty');

  const doc = JSON.parse(raw) as JobsDoc;
  const job = doc.jobs.find(j => j.code === code);
  if (!job) return jsonErr(404, 'unknown_job', `no job with code ${code}`);

  return json({ code: job.code, name: job.name, abilities: job.abilities });
};
