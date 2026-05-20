/**
 * Plan domain types — Pages Functions copy. Kept in sync with:
 *   - do-worker/src/types.ts
 *   - web/src/types.ts
 */

export type Role = 'tank' | 'heal' | 'dps';
export type MitType = 'personal' | 'party' | 'heal';
export type MechType = 'raidwide' | 'tankbuster' | 'autos' | 'custom';
export type DamageKind = 'physical' | 'magical' | 'pure';
export type MitKind = 'all' | 'physical' | 'magical';

export interface Ability {
  id: string;
  name: string;
  recast: number;
  effect: number;
  mit_type: MitType;
  mit_potency: number;
  mit_kind?: MitKind;
  icon: string;
  /** xivapi/FFLogs game action ID — used to map FFLogs cast events to
   *  abilities when importing a log. */
  action_id?: number;
  level_unlocked: number;
  verified?: boolean;
  _source_url?: string;
}

export interface Job {
  code: string;
  name: string;
  role: Role;
  sub_role: string;
  position_order: number;
  icon: string;
  abilities: Ability[];
}

export interface Player {
  id: string;
  name: string;
  job: string;
  badge: 'MT' | 'OT' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';
}

export interface BossLane {
  id: string;
  name: string;
}

export type MechCategory = 'damage' | 'placement';

export interface Mechanic {
  id: string;
  lane_id: string;
  name: string;
  time: number;
  category: MechCategory;
  targets: string[];
  damage_kind?: DamageKind;
  hit_count?: number;
  type?: MechType;
}

export interface Use {
  id: string;
  player_id: string;
  ability_id: string;
  time: number;
}

export interface PlanMeta {
  slug: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Encounter {
  fight_name: string;
  fight_duration: number;
  party_ilvl: number | null;
}

export interface Plan {
  meta: PlanMeta;
  encounter: Encounter;
  party: Player[];
  boss_lanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];
}

export interface Env {
  JOBS_KV: KVNamespace;
  PLAN_DO: DurableObjectNamespace;
  ENVIRONMENT?: string;
}
