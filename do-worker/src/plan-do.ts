/**
 * PlanDO — one Durable Object per plan slug. State is the whole Plan JSON
 * persisted under a single key 'plan' in the DO's transactional storage.
 *
 * Internal HTTP surface (called by Pages Functions via stub.fetch):
 *   GET    /         -> Plan
 *   PATCH  /         -> { ok: true, plan: Plan }   (shallow merge)
 *   DELETE /         -> { ok: true }
 */

import type { Plan } from './types';

const SCHEMA_VERSION = 1;

export class PlanDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    try {
      switch (req.method) {
        case 'GET':
          return this.handleGet();
        case 'POST':
          return this.handleInit(req);
        case 'PATCH':
          return this.handlePatch(req);
        case 'DELETE':
          return this.handleDelete();
        default:
          return jsonErr(405, 'method_not_allowed', `${req.method} ${url.pathname}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonErr(500, 'internal_error', msg);
    }
  }

  private async handleGet(): Promise<Response> {
    const plan = await this.state.storage.get<Plan>('plan');
    if (!plan) return jsonErr(404, 'not_found', 'plan not initialized');
    return json(plan);
  }

  private async handleInit(req: Request): Promise<Response> {
    const existing = await this.state.storage.get<Plan>('plan');
    if (existing) return jsonErr(409, 'already_exists', 'plan already initialized');

    const body = (await req.json().catch(() => ({}))) as Partial<Plan>;
    const now = new Date().toISOString();
    const plan: Plan = {
      meta: {
        slug: body.meta?.slug ?? '',
        owner_id: body.meta?.owner_id ?? null,
        created_at: now,
        updated_at: now,
      },
      encounter: {
        fight_name: body.encounter?.fight_name ?? '',
        fight_duration: body.encounter?.fight_duration ?? 600,
        party_ilvl: body.encounter?.party_ilvl ?? null,
        level: body.encounter?.level ?? 100,
      },
      party: body.party ?? [],
      boss_lanes: body.boss_lanes ?? [{ id: 'lane-1', name: 'BOSS A' }],
      mechanics: body.mechanics ?? [],
      uses: body.uses ?? [],
      hidden_ability_ids: body.hidden_ability_ids ?? [],
    };

    await this.state.storage.put('plan', plan);
    await this.state.storage.put('_schema_version', SCHEMA_VERSION);
    return json({ ok: true, plan });
  }

  private async handlePatch(req: Request): Promise<Response> {
    const current = await this.state.storage.get<Plan>('plan');
    if (!current) return jsonErr(404, 'not_found', 'plan not initialized');

    const patch = (await req.json().catch(() => ({}))) as Partial<Plan>;
    // Backfill defaults for any field a legacy stored plan might lack
    // (level was added in Phase O — old plans persisted before then have
    // no encounter.level / hidden_ability_ids). Runtime value may be
    // undefined even though the TS type marks `level` required.
    const currentEncounter = {
      ...current.encounter,
      level: current.encounter.level ?? 100,
    };
    const merged: Plan = {
      meta: { ...current.meta, ...(patch.meta ?? {}), updated_at: new Date().toISOString() },
      encounter: { ...currentEncounter, ...(patch.encounter ?? {}) },
      party: patch.party ?? current.party,
      boss_lanes: patch.boss_lanes ?? current.boss_lanes,
      mechanics: patch.mechanics ?? current.mechanics,
      uses: patch.uses ?? current.uses,
      hidden_ability_ids: patch.hidden_ability_ids ?? current.hidden_ability_ids ?? [],
    };

    await this.state.storage.put('plan', merged);
    return json({ ok: true, plan: merged });
  }

  private async handleDelete(): Promise<Response> {
    await this.state.storage.deleteAll();
    return json({ ok: true });
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonErr(status: number, error: string, message: string): Response {
  return json({ error, message }, status);
}
