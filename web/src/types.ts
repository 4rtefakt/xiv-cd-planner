/**
 * Shared domain types — front side. Duplicated in functions/_types.ts.
 * If you change one, change the other. See CLAUDE.md.
 */

export type Role = 'tank' | 'heal' | 'dps';
export type MitType = 'personal' | 'party' | 'heal';
export type MechType = 'raidwide' | 'tankbuster' | 'autos' | 'custom';

export interface Ability {
  id: string;                 // e.g. 'PLD.HallowedGround'
  name: string;
  recast: number;             // seconds
  effect: number;             // seconds
  mit_type: MitType;
  mit_potency: number;        // realistic % per ability (e.g. Reprisal=10, Holmgang=100)
  icon: string;               // absolute URL (xivapi /i/folder/id.png)
  icon_glyph?: string;        // symbolic name for SVG fallback ('shield', 'aegis', …)
  icon_id?: number;           // raw xivapi icon id, for debugging
  level_unlocked: number;
  verified?: boolean;
  _source_url?: string;
}

export interface Job {
  code: string;               // 'PLD'
  name: string;
  role: Role;
  sub_role: string;
  position_order: number;
  icon: string;
  abilities: Ability[];
}

export interface Player {
  id: string;                 // 'p1'..'p8'
  name: string;
  job: string;                // 'PLD'
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
  time: number;               // seconds
  type: MechType;
}

export interface Use {
  id: string;
  player_id: string;
  ability_id: string;         // 'PLD.HallowedGround'
  time: number;               // seconds (start of effect)
}

export interface PlanMeta {
  slug: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Encounter {
  fight_name: string;
  fight_duration: number;     // seconds
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
