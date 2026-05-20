/**
 * Plan domain types — DO-worker copy. Kept in sync with:
 *   - functions/_types.ts (Pages Functions)
 *   - web/src/types.ts    (frontend)
 *
 * Don't import across workspaces at runtime — duplication is intentional.
 */

export type Role = 'tank' | 'heal' | 'dps';
export type MitType = 'personal' | 'party' | 'heal';
export type MechType = 'raidwide' | 'tankbuster' | 'autos' | 'custom';
export type DamageKind = 'physical' | 'magical' | 'pure';

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

export interface Mechanic {
  id: string;
  lane_id: string;
  name: string;
  time: number;
  type: MechType;
  damage_kind?: DamageKind;
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
