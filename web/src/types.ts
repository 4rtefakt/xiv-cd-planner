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
  /** Per-level UPGRADES. Base fields = the ability's LOWEST-level form
   *  (what you get at level_unlocked). Each key is the level where a
   *  trait or action upgrade kicks in ; its patch applies from that
   *  level upward (keys ≤ level merge in ascending order, higher keys
   *  overwrite lower ones). Keys can be any level — trait levels like
   *  88/94/98 work even though encounters only use the 50…100 brackets.
   *  Two flavours :
   *    - trait : `{ 98: { effect: 15 } }` on Reprisal (10s before 98)
   *    - action upgrade : `{ 82: { name: 'Holy Sheltron', icon: …,
   *      action_id: … } }` on Sheltron — name/icon/stats all swap. */
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

/**
 * 'damage'    — deals damage to players ; carries a damage_kind and
 *               participates in the coverage calc.
 * 'placement' — positional cue, nothing to mitigate.
 * 'cast'      — a boss cast (the "sorts" tab in FFLogs) imported as a
 *               standalone entry. What players actually see on the cast
 *               bar. No reliable damage_kind (cast and damage are
 *               distinct FFLogs objects), so treated as non-mitigable
 *               like a placement for coverage. Toggleable on its own.
 */
export type MechCategory = 'damage' | 'placement' | 'cast';

export interface Mechanic {
  id: string;
  lane_id: string;
  /** Display name in the import locale (FFLogs returns English). When
   *  the user toggles the UI to French, `name_fr` takes precedence if
   *  present — otherwise we fall back to this. */
  name: string;
  /** French display name, populated at import time from xivapi (when
   *  game_id is known) or lazily on first FR render for older plans. */
  name_fr?: string;
  /** xivapi/FFLogs action id. Kept so the client can lazily fetch a FR
   *  translation for plans imported before `name_fr` enrichment shipped. */
  game_id?: number;
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
  /** Short user-applied labels (TB, RB, SHARE, SPREAD, BAIT, …) shown
   *  as tiny chips next to the mech label. Free-form — presets are a
   *  UI nicety, not a constraint. */
  tags?: string[];
}

/**
 * Named phase marker (P1, INTERMISSION, …). Rendered as a labeled
 * vertical line across the whole timeline at `time`. Pure annotation —
 * no impact on coverage.
 */
export interface Phase {
  id: string;
  name: string;
  time: number;               // seconds — start of the phase
}

export interface Use {
  id: string;
  player_id: string;
  ability_id: string;         // 'PLD.HallowedGround'
  time: number;               // seconds (start of effect)
}

/**
 * A named pull pattern ("PULL #1", "PULL #2", …) — multi-pull design,
 * increment 1 (see docs/design/multi-pull.md). Each variant carries a
 * FULL copy of its mechanics + uses (no deltas yet). The plan's
 * top-level `mechanics`/`uses` mirror the ACTIVE variant for backward
 * compatibility ; `variants` is the source of truth when present. The
 * party is shared across all variants (the 8 fixed slots p1..p8).
 */
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
  /** Phase markers (P1/P2/…). Optional for plans stored before the
   *  field existed — treated as []. */
  phases?: Phase[];
  /** Pull variants (multi-pull, inc.1). Optional — legacy plans are
   *  backfilled to a single variant carrying `mechanics`/`uses`, same
   *  migration pattern as `phases`. See docs/design/multi-pull.md. */
  variants?: PullVariant[];
}
