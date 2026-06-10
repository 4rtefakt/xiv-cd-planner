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

export type MechCategory = 'damage' | 'placement';

export interface Mechanic {
  id: string;
  lane_id: string;
  name: string;
  /** French in-game name — see web/src/types.ts. */
  name_fr?: string;
  /** xivapi/FFLogs action id — see web/src/types.ts. */
  game_id?: number;
  time: number;
  category: MechCategory;
  targets: string[];
  damage_kind?: DamageKind;
  hit_count?: number;
  cast_time?: number;
  type?: MechType;
  /** Short user-applied labels — see web/src/types.ts. */
  tags?: string[];
}

/** Phase marker — see web/src/types.ts. */
export interface Phase {
  id: string;
  name: string;
  time: number;
}

export interface Use {
  id: string;
  player_id: string;
  ability_id: string;
  time: number;
}

/** A named pull pattern — multi-pull inc.1. See web/src/types.ts. */
export interface PullVariant {
  id: string;
  name: string;
  mechanics: Mechanic[];
  uses: Use[];
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
  /** Player level (50, 60, 70, 80, 90, 100). Defaults to 100. */
  level: number;
}

export interface Plan {
  meta: PlanMeta;
  encounter: Encounter;
  party: Player[];
  boss_lanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];
  /** Per-plan blacklist of ability ids to hide from the player rows. */
  hidden_ability_ids: string[];
  /** Phase markers — optional for legacy stored plans. */
  phases?: Phase[];
  /** Pull variants — optional, backfilled to a single variant. */
  variants?: PullVariant[];
}
