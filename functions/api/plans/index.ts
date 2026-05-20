import type { Env, Plan } from '../../_types';
import { json, jsonErr, makeSlug, readJson } from '../../_lib';

interface CreatePlanBody {
  encounter?: Partial<Plan['encounter']>;
  party?: Plan['party'];
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = (await readJson<CreatePlanBody>(ctx.request)) ?? {};

  const slug = makeSlug(8);
  const id = ctx.env.PLAN_DO.idFromName(slug);
  const stub = ctx.env.PLAN_DO.get(id);

  const initPayload: Partial<Plan> = {
    meta: {
      slug,
      owner_id: null,
      created_at: '',
      updated_at: '',
    },
    encounter: {
      fight_name: body.encounter?.fight_name ?? '',
      fight_duration: body.encounter?.fight_duration ?? 600,
      party_ilvl: body.encounter?.party_ilvl ?? null,
    },
    party: body.party ?? [],
    boss_lanes: [{ id: 'lane-1', name: 'BOSS A' }],
    mechanics: [],
    uses: [],
  };

  const res = await stub.fetch('https://do/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(initPayload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return jsonErr(res.status, 'do_init_failed', errBody || `DO returned ${res.status}`);
  }

  const created = (await res.json()) as { ok: boolean; plan: Plan };
  return json({ slug, plan: created.plan }, 201);
};
