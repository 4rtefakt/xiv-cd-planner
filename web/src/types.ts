/**
 * Shared domain types — front side. Duplicated in functions/_types.ts.
 * If you change one, change the other. See CLAUDE.md.
 */

export type Role = 'tank' | 'heal' | 'dps';
export type MitType = 'personal' | 'party' | 'heal';
export type MechType = 'raidwide' | 'tankbuster' | 'autos' | 'custom';
export type DamageKind = 'physical' | 'magical' | 'pure';
/**
 * Which damage kinds an ability mitigates. 'all' = both physical and
 * magical (the default for almost every defensive). Magic-only and
 * phys-only abilities (Dark Mind, Magick Barrier, Bulwark…) set the
 * narrower value so the coverage calc ignores them on the wrong kind.
 */
export type MitKind = 'all' | 'physical' | 'magical';

export interface Ability {
  id: string;                 // e.g. 'PLD.HallowedGround'
  name: string;
  name_fr?: string;           // French in-game name (Sol consacré, …)
  recast: number;             // seconds
  effect: number;             // seconds
  mit_type: MitType;
  mit_potency: number;        // realistic % per ability (e.g. Reprisal=10, Holmgang=100)
  mit_kind?: MitKind;         // default 'all' when omitted
  icon: string;               // absolute URL (xivapi /i/folder/id.png)
  icon_glyph?: string;        // symbolic name for SVG fallback ('shield', 'aegis', …)
  icon_id?: number;           // raw xivapi icon id, for debugging
  /** xivapi/FFLogs game action ID — used to map FFLogs cast events back
   *  onto our ability rows when importing a log. Optional because legacy
   *  rows haven't all been backfilled. */
  action_id?: number;
  level_unlocked: number;
  /** In-game description text (EN + FR). Scraped from xivapi by
   *  scripts/fetch-tooltip-data.mjs. Wrapped in the tooltip body as-is. */
  description?: string;
  description_fr?: string;
  /** Number of charges the ability can hold simultaneously (Bloodwhetting:
   *  2, Aetherflow stacks: 3, …). Absent or 1 = no charge system. */
  max_charges?: number;
  /** When set, this ability's recast timer is shared with the listed
   *  ability names (display strings, not ids — quick for the user to
   *  parse). e.g. Drill shares with Bioblaster + Air Anchor. */
  shares_recast_with?: string[];
  /** Job affinity carried over from FFXIV's "Affinity" field — the
   *  pre-joined display string ("GLA PGL MRD … VPR"). Stored verbatim
   *  from xivapi.ClassJobCategory.Name / Name_fr. EN + FR variants
   *  because the FR client uses different abbreviations (HAS, SUR…). */
  affinity?: string;
  affinity_fr?: string;
  /** Per-level overrides. Key = max level bracket (50, 60, 70, 80, 90,
   *  100). resolveAbilityAtLevel(ab, level) picks the highest bracket
   *  ≤ level whose entry exists and merges its keys over the base. So
   *  `{ 70: { mit_potency: 25 }, 90: { mit_potency: 30 } }` means base
   *  value applies at 100, 30% applies at 90, 25% at 70 and 80. */
  level_variants?: Record<number, Partial<Omit<Ability, 'id' | 'level_variants'>>>;
  verified?: boolean;
  _source_url?: string;
}

export interface Job {
  code: string;               // 'PLD'
  name: string;
  name_fr?: string;
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

export type MechCategory = 'damage' | 'placement';

export interface Mechanic {
  id: string;
  lane_id: string;
  name: string;
  time: number;               // seconds — impact time (end of cast)
  category: MechCategory;
  /** Player IDs hit by this mech. Empty array means "no one" (a pure
   *  placement mechanic, but also a damage mech where the user hasn't
   *  picked targets yet). Length === party.length means raidwide. */
  targets: string[];
  damage_kind?: DamageKind;   // only meaningful when category === 'damage'
  /** Number of FFLogs damage events aggregated into this mech (multi-hit
   *  AoEs and DoT ticks). 1 or undefined = single hit. Rendered as a
   *  superscript ×N badge over the cap when > 1. */
  hit_count?: number;
  /** Boss cast time, in seconds. The cast bar visualises from
   *  (time - cast_time) to time. Coverage math is unchanged — the
   *  impact still lands at `time`, the bar is purely a visual cue so
   *  the planner can align mitigations with the cast bar. 0 / undefined
   *  = instant mech (no cast bar shown). */
  cast_time?: number;
  /** Legacy field kept for migration ; new mechs derive their visual
   *  type from category + targets via deriveMechType(). */
  type?: MechType;
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
  /** Player level for this fight — 50, 60, 70, 80, 90, 100. Used to
   *  hide abilities that aren't unlocked yet (level_unlocked > level)
   *  and, later, to pick level-scaled potency/recast values. Defaults
   *  to 100 so legacy plans without the field behave as max-level. */
  level: number;
}

export interface Plan {
  meta: PlanMeta;
  encounter: Encounter;
  party: Player[];
  boss_lanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];
  /** Per-plan blacklist : ability ids hidden from the player rows for
   *  this room (e.g. a CD that the team decided not to use, or a job
   *  variant that's irrelevant). Coverage calc ignores them. */
  hidden_ability_ids: string[];
}
