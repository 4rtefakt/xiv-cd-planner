/**
 * Global app state via Zustand. Owns:
 *  - jobs cache (fetched once from /api/jobs)
 *  - current plan slug (null until first persistent save)
 *  - encounter, party, boss lanes, mechanics, uses
 *  - UI-only state (collapsed players, save status)
 *
 * Mutations are direct setState calls; persistence to the API happens
 * outside the store (planned: a useAutoSave hook in C.5). The store is
 * the single source of truth — no scattered useState in components.
 */

import { create } from 'zustand';
import type { BossLane, DamageKind, Encounter, Job, MechCategory, MechType, Mechanic, Phase, Player, PullVariant, Use } from '../types';
import { demoParty } from '../data/demoParty';
import { loadStoredLang, storeLang, type Lang } from '../i18n';
import { loadStoredOrientation, storeOrientation, type Orientation } from '../lib/orientation';
import { duplicateVariant, ensureVariants, nextVariantName, singleVariant, syncActiveVariant } from '../lib/variants';

/**
 * FFLogs subType (Paladin, WhiteMage, BlackMage, …) → our seed job
 * code (PLD, WHM, BLM). FFLogs stores classes as PascalCase strings ;
 * we keep our own 3-letter codes for compactness.
 */
const SUBTYPE_TO_JOB: Record<string, string> = {
  Paladin: 'PLD', Warrior: 'WAR', DarkKnight: 'DRK', Gunbreaker: 'GNB',
  WhiteMage: 'WHM', Scholar: 'SCH', Astrologian: 'AST', Sage: 'SGE',
  Monk: 'MNK', Dragoon: 'DRG', Ninja: 'NIN', Samurai: 'SAM', Reaper: 'RPR', Viper: 'VPR',
  Bard: 'BRD', Machinist: 'MCH', Dancer: 'DNC',
  BlackMage: 'BLM', Summoner: 'SMN', RedMage: 'RDM', Pictomancer: 'PCT',
};

const SLOT_BADGES = ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'] as const;

/**
 * Build an 8-slot Player[] from a FFLogs roster. Two-pass allocator :
 *   1. Each badge picks from its expected bucket (MT/OT from tanks,
 *      H1/H2 from heals, M1/M2 from melee, R1 from phys-ranged then
 *      caster, R2 from caster then phys-ranged).
 *   2. Every player still unassigned (off-meta comps : 3 ranged + 1
 *      melee, 3 tanks, …) fills the remaining empty slots in order —
 *      nobody from the log is ever dropped just because their bucket
 *      overflowed.
 * Slots still empty after both passes keep the placeholder names from
 * the existing party (Tank 1, Healer 1, …).
 */
function mapLogPlayersToParty(
  players: Array<{ name: string; subType: string }>,
  jobs: Job[],
  fallback: Player[],
): Player[] {
  type Resolved = { name: string; code: string; role: string; subRole: string };
  const resolved: Resolved[] = [];
  for (const p of players) {
    const code = SUBTYPE_TO_JOB[p.subType];
    if (!code) continue;
    const job = jobs.find((j) => j.code === code);
    if (!job) continue;
    resolved.push({ name: p.name, code, role: job.role, subRole: job.sub_role });
  }
  if (resolved.length === 0) return fallback;

  const tanks = resolved.filter((p) => p.role === 'tank');
  const heals = resolved.filter((p) => p.role === 'heal');
  const melee = resolved.filter((p) => p.subRole === 'melee');
  const phys = resolved.filter((p) => p.subRole === 'phys_ranged');
  const caster = resolved.filter((p) => p.subRole === 'magic_ranged');

  // Pass 1 — preferred buckets per badge.
  const picks: (Resolved | undefined)[] = SLOT_BADGES.map((badge) => {
    if (badge === 'MT' || badge === 'OT') return tanks.shift();
    if (badge === 'H1' || badge === 'H2') return heals.shift();
    if (badge === 'M1' || badge === 'M2') return melee.shift();
    if (badge === 'R1') return phys.shift() ?? caster.shift();
    return caster.shift() ?? phys.shift(); // R2
  });

  // Pass 2 — distribute the overflow into whatever slots stayed empty.
  // DPS slots are served first so an extra ranged lands in M2 rather
  // than evicting a placeholder healer seat.
  const leftovers = [...melee, ...phys, ...caster, ...tanks, ...heals];
  const FILL_ORDER = [4, 5, 6, 7, 0, 1, 2, 3]; // M1 M2 R1 R2 MT OT H1 H2
  for (const i of FILL_ORDER) {
    if (leftovers.length === 0) break;
    if (!picks[i]) picks[i] = leftovers.shift();
  }

  const result: Player[] = [];
  for (let i = 0; i < SLOT_BADGES.length; i++) {
    const badge = SLOT_BADGES[i]!;
    const pick = picks[i];
    if (pick) {
      result.push({ id: `p${i + 1}`, name: pick.name, job: pick.code, badge });
    } else {
      // No matching role in the log roster — preserve the placeholder
      // slot from the previous party so the UI doesn't end up with
      // missing seats.
      const prev = fallback[i];
      if (prev) result.push({ ...prev, id: `p${i + 1}`, badge });
    }
  }
  return result;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface MechanicModalState {
  /** 'create' opens an empty modal anchored to a lane+time. 'edit'
   *  pre-fills from an existing mechanic and replaces it on confirm. */
  mode: 'create' | 'edit';
  mechanicId?: string;       // set when mode === 'edit'
  laneId: string;
  time: number;
  name: string;
  category: MechCategory;
  targets: string[];
  damage_kind: DamageKind;
  cast_time: number;          // 0 = instant, visualised as a cast bar before `time`
  /** User tags (TB, RB, SHARE, …) — chips next to the mech label. */
  tags: string[];
  /** Legacy visual flavour — kept for the modal's color-flavor picker
   *  if we re-add it later. Unused for now ; derived from targets. */
  type?: MechType;
}

/**
 * Drag context used by:
 *   - kind: 'use'  → repositioning an existing CdUse within its row.
 *   - kind: 'mech' → repositioning a Mechanic within its boss lane.
 *
 * (D.1 removed the 'chip' drag pipeline; placement is now a click on
 * the AbilityRow, see usePlanStore.previewUse.)
 */
export interface DragCtx {
  kind: 'use' | 'mech';
  playerId?: string;
  abilityId?: string;
  useId?: string;
  mechId?: string;
  /** Pixel offset between the cursor and the dragged element's left edge
   *  at the moment of grab. Subtracted from clientX in dragover/drop so
   *  the element stays "anchored" to where the user grabbed it. */
  grabOffsetPx?: number;
}

/**
 * Hover-state for the click-to-place pipeline. When non-null, the
 * AbilityRow at (player_id, ability_id) shows a ghost CdUse at `time`,
 * Mechanic markers that would be covered render with .preview-covered,
 * and a click anywhere on the same row commits the Use.
 *
 * `excludeUseId` is set when the hover represents a REPOSITION drag (the
 * use is already in uses[] — for the simulated-coverage calc we skip it
 * at its current time and re-add it at the preview time, so the badge
 * shows the future value not double-counted).
 */
export interface PreviewUse {
  player_id: string;
  ability_id: string;
  time: number;
  conflict: boolean;
  excludeUseId?: string;
  /** True when computePreviewAt snapped the cursor time to a nearby
   *  mechanic's time (within SNAP_THRESHOLD_S). Used to render a small
   *  visual cue on the ghost. */
  snapped?: boolean;
}

interface PlanState {
  // Modal
  mechanicModal: MechanicModalState | null;
  // Drag (CdUse + Mechanic repositioning)
  dragCtx: DragCtx | null;
  // Hover preview for click-to-place
  previewUse: PreviewUse | null;
  // Reference data
  jobs: Job[];
  jobsLoading: boolean;
  jobsError: string | null;

  // Plan identity
  slug: string | null;
  saveStatus: SaveStatus;
  /** Transient flag : tells AutoSaver to skip the next effect run.
   *  Set by hydratePlan so the slice changes from a server fetch don't
   *  trigger a redundant PATCH back to the same data. */
  _skipNextSave: boolean;
  /** Read-only view : URL ?view=read disables all mutation affordances
   *  (drag, click-to-place, modals, rename, …) and suspends AutoSaver. */
  readOnly: boolean;
  /** UI language. Persisted in localStorage (see i18n.ts). Initial
   *  value comes from localStorage or navigator.language detection. */
  lang: Lang;
  /** Timeline orientation. 'horizontal' = time runs left→right (default,
   *  rows per ability) ; 'vertical' = time runs top→bottom (columns per
   *  ability). Per-device UI preference persisted in localStorage, NOT in
   *  the plan blob (see lib/orientation.ts). */
  orientation: Orientation;

  // Plan content
  encounter: Encounter;
  party: Player[];
  bossLanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];
  /** Phase markers (P1/P2/…) — labeled vertical lines on the timeline. */
  phases: Phase[];
  /** Per-plan blacklist of ability ids hidden from the player rows.
   *  Stored in the Plan blob so it travels with the slug. */
  hiddenAbilityIds: string[];

  // Multi-pull (inc.1) — see docs/design/multi-pull.md.
  /** All pull variants. Always ≥ 1 after init/hydrate. The ACTIVE
   *  variant's mechanics/uses are mirrored into the top-level
   *  `mechanics`/`uses` above (the live editing surface) ; the entry
   *  here is reconciled lazily at the persist / undo / switch
   *  boundaries via syncActiveVariant(). `variants` is the source of
   *  truth on load. */
  variants: PullVariant[];
  /** Id of the variant currently shown in the timeline. Store-only UI
   *  state — not persisted ; on load we default to the first variant. */
  activeVariantId: string;

  // UI
  collapsed: Record<string, boolean>;
  /** Timeline horizontal zoom. 1 = "base" (≈ all 600s fit a 1600px-wide
   *  canvas). Default 2 starts users zoomed-in so 5-ish minutes fill the
   *  viewport, which is more precise for placement. Range [0.5, 8]. */
  zoom: number;
  /** Mech categories the user has chosen to hide on the timeline. Pure
   *  view-state — mechs in this set still exist in plan data and still
   *  count for coverage, they just don't render. */
  hiddenMechCategories: MechCategory[];
  /** Compact rendering mode for the boss timeline : labels are hidden,
   *  only the cap diamonds + damage_kind badges remain. Hover surfaces
   *  the full label as a tooltip. Toggleable from the VIEW toolbar. */
  compactMechs: boolean;

  // Actions — reference
  setJobs(jobs: Job[]): void;
  setJobsError(msg: string | null): void;
  setJobsLoading(loading: boolean): void;

  // Actions — encounter
  setEncounter(patch: Partial<Encounter>): void;

  // Actions — party
  setParty(party: Player[]): void;
  setPlayerName(playerId: string, name: string): void;
  /**
   * Swap a player with their neighbour (dir −1 = up/left, +1 =
   * down/right). Players keep their id (uses and mech targets follow
   * them) ; BADGES stay glued to the slot position, so moving someone
   * into slot 0 makes them MT.
   */
  movePlayer(playerId: string, dir: -1 | 1): void;
  /**
   * Replace the entire party. Uses are remapped per slot (p1..p8) by
   * ability name : if the slot's new job has an ability with the same
   * name as the old use's ability, the use survives with the new id.
   * Otherwise it's dropped. Same logic as switchPlayerJob but applied
   * to all 8 slots at once.
   */
  importParty(newParty: Player[]): void;
  /**
   * Replace encounter + boss-lane + mechanics with a synthesised import
   * from an external log (FFLogs, later ACT). The current party is
   * preserved ; uses are cleared (they no longer line up with the new
   * fight's mechanics). targetNames from the log are mapped to current
   * party slots heuristically — full party = raidwide, single target =
   * first tank, otherwise empty (user edits later).
   */
  importFightFromLog(payload: {
    fightName: string;
    fightDuration: number;
    /** Synced/max player level inferred from the report's expansion or
     *  zone. Falls back to the current encounter.level if not provided. */
    gameLevel?: number;
    /** Ordered boss lane names from the FFLogs source analysis. One
     *  BossLane is created per entry (e.g. ["Shinryu", "Right Wing",
     *  "Left Wing", "Adds"]). If the array is empty, falls back to a
     *  single "BOSS A" lane. */
    bossLanes?: string[];
    /** Player roster (from FFLogs masterData). When provided and
     *  non-empty, the current party is replaced — players are mapped
     *  by subType to our job codes and badges are auto-assigned. */
    players?: Array<{ name: string; subType: string }>;
    mechanics: Array<{
      name: string;
      name_fr?: string;
      game_id?: number;
      time: number;
      targetNames: string[];
      damage_kind: 'physical' | 'magical' | 'pure';
      source_name?: string;
      hit_count?: number;
      cast_time?: number;
    }>;
    /** Standalone boss casts (FFLogs "sorts" tab) imported as 'cast'
     *  category mechs, in addition to the damage mechs above. No
     *  damage_kind / targets — they're non-mitigable visual cues with
     *  their own display toggle. */
    bossCasts?: Array<{
      name: string;
      name_fr?: string;
      game_id?: number;
      time: number;
      cast_time?: number;
      source_name?: string;
      hit_count?: number;
    }>;
    /** Friendly cast events from the log. Mapped to Uses[] via
     *  playerName→player_id (in newParty) and (job+actionId)→ability_id
     *  (in jobs seed). Casts we can't resolve are silently dropped. */
    playerUses?: Array<{
      playerName: string;
      actionId: number;
      time: number;
    }>;
  }): void;
  /**
   * Switch a player to a new job. Uses are remapped by ability NAME:
   * shared abilities (Reprisal, Rampart, Arm's Length, ...) survive
   * because every job has its own copy under the same name. Job-specific
   * abilities (Hallowed Ground on PLD, Holmgang on WAR, ...) are dropped.
   */
  switchPlayerJob(playerId: string, newJobCode: string): void;

  // Actions — pull variants (multi-pull, inc.1)
  /** Duplicate the active variant into a new "PULL #n" and switch to it. */
  addVariant(): void;
  /** Remove a variant. No-op on the last one ; if the active variant is
   *  removed, falls back to the first remaining. */
  removeVariant(id: string): void;
  /** Rename a variant (the tab label). */
  renameVariant(id: string, name: string): void;
  /** Make `id` the active variant : the current edits are synced back
   *  into the outgoing variant, then the target's mechanics/uses become
   *  the live top-level surface. */
  switchVariant(id: string): void;

  // Actions — boss lanes
  addBossLane(): void;
  removeBossLane(id: string): void;
  setBossLaneName(id: string, name: string): void;
  /** Merge `fromId` into `toId` : every mech belonging to `fromId` is
   *  reassigned to `toId`, then `fromId` is removed. No-ops if the
   *  source or destination doesn't exist or both ids are the same. */
  mergeBossLanes(fromId: string, toId: string): void;
  /** Swap a boss lane with its neighbour (dir −1 = up, +1 = down). */
  moveBossLane(id: string, dir: -1 | 1): void;

  // Actions — phases
  addPhase(): void;
  removePhase(id: string): void;
  setPhaseName(id: string, name: string): void;
  movePhase(id: string, time: number): void;

  // Actions — modal
  openMechanicModal(
    laneId: string,
    time: number,
    init?: {
      category?: MechCategory;
      targets?: string[];
      damage_kind?: DamageKind;
      name?: string;
      cast_time?: number;
    },
  ): void;
  openEditMechanic(mech: Mechanic): void;
  setMechanicModal(patch: Partial<MechanicModalState>): void;
  closeMechanicModal(): void;

  // Actions — drag
  setDragCtx(ctx: DragCtx | null): void;

  // Actions — preview (click-to-place hover)
  setPreviewUse(p: PreviewUse | null): void;

  // Actions — mechanics
  addMechanic(m: Mechanic): void;
  removeMechanic(id: string): void;
  moveMechanic(id: string, time: number): void;
  updateMechanic(id: string, patch: Partial<Mechanic>): void;

  // Actions — uses
  addUse(u: Use): void;
  removeUse(id: string): void;
  moveUse(id: string, time: number): void;

  // Actions — hidden abilities (per-plan blacklist)
  toggleAbilityHidden(abilityId: string): void;
  setHiddenAbilityIds(ids: string[]): void;

  // Actions — UI
  toggleCollapsed(playerId: string): void;
  expandPlayer(playerId: string): void;
  setZoom(zoom: number): void;
  toggleMechCategoryVisibility(cat: MechCategory): void;
  toggleCompactMechs(): void;

  // Actions — reset
  resetEncounter(): void;

  // Actions — persistence (C.5) + history (M.3) + view mode (M.4)
  setSlug(slug: string | null): void;
  setSaveStatus(status: SaveStatus): void;
  setReadOnly(readOnly: boolean): void;
  setLang(lang: Lang): void;
  setOrientation(orientation: Orientation): void;
  toggleOrientation(): void;
  /** Used by historyManager to swap back to a past snapshot. */
  restoreSnapshot(snap: {
    encounter: Encounter;
    party: Player[];
    bossLanes: BossLane[];
    mechanics: Mechanic[];
    uses: Use[];
    hiddenAbilityIds: string[];
    phases: Phase[];
    variants: PullVariant[];
    activeVariantId: string;
  }): void;
  /**
   * Replace the entire plan content from a server payload. Used by
   * PlanLoader on initial /p/:slug fetch. Resets transient UI state so
   * a stale collapsed/modal doesn't leak across plan loads.
   */
  hydratePlan(plan: {
    meta?: { slug?: string };
    encounter?: Encounter;
    party?: Player[];
    boss_lanes?: BossLane[];
    mechanics?: Mechanic[];
    uses?: Use[];
    hidden_ability_ids?: string[];
    phases?: Phase[];
    variants?: PullVariant[];
  }): void;
}

const defaultEncounter: Encounter = {
  fight_name: 'M3S — Brute Abominator',
  fight_duration: 600,
  party_ilvl: 735,
  level: 100,
};

export const usePlanStore = create<PlanState>((set) => ({
  mechanicModal: null,
  dragCtx: null,
  previewUse: null,
  jobs: [],
  jobsLoading: false,
  jobsError: null,
  slug: null,
  saveStatus: 'idle',
  _skipNextSave: false,
  readOnly: false,
  lang: loadStoredLang(),
  orientation: loadStoredOrientation(),
  encounter: defaultEncounter,
  party: demoParty,
  bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
  mechanics: [],
  uses: [],
  phases: [],
  hiddenAbilityIds: [],
  variants: [{ id: 'variant-1', name: 'PULL #1', mechanics: [], uses: [] }],
  activeVariantId: 'variant-1',
  collapsed: {},
  zoom: 2,
  hiddenMechCategories: [],
  compactMechs: false,

  setJobs: (jobs) => set({ jobs, jobsLoading: false, jobsError: null }),
  setJobsError: (jobsError) => set({ jobsError, jobsLoading: false }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),

  setEncounter: (patch) => set((s) => ({ encounter: { ...s.encounter, ...patch } })),

  setParty: (party) => set({ party }),
  setPlayerName: (playerId, name) =>
    set((s) => ({ party: s.party.map((p) => (p.id === playerId ? { ...p, name } : p)) })),
  movePlayer: (playerId, dir) =>
    set((s) => {
      const idx = s.party.findIndex((p) => p.id === playerId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= s.party.length) return {};
      const party = [...s.party];
      [party[idx], party[j]] = [party[j]!, party[idx]!];
      // Badges belong to the SLOT : re-stamp them by position so the
      // first card is always MT, the second OT, etc.
      return {
        party: party.map((p, i) => ({ ...p, badge: SLOT_BADGES[i] ?? p.badge })),
      };
    }),
  importFightFromLog: (payload) =>
    set((s) => {
      // Build one lane per detected source ; fall back to a single
      // "BOSS A" if FFLogs didn't surface any (e.g. older API path).
      const laneNames =
        payload.bossLanes && payload.bossLanes.length > 0 ? payload.bossLanes : ['BOSS A'];
      const lanes = laneNames.map((name, i) => ({
        id: `lane-${i + 1}`,
        name: name.toUpperCase(),
      }));
      // name → lane_id map. Mechs whose source_name doesn't match any
      // lane (shouldn't happen if the server emitted consistent data)
      // fall back to the last lane (typically "Adds" or the only lane).
      const nameToLane = new Map<string, string>();
      for (let i = 0; i < lanes.length; i++) nameToLane.set(laneNames[i]!, lanes[i]!.id);
      const fallbackLaneId = lanes[lanes.length - 1]!.id;

      // Build a new party from the log's roster, if provided. Otherwise
      // reuse the existing party.
      const newParty =
        payload.players && payload.players.length > 0
          ? mapLogPlayersToParty(payload.players, s.jobs, s.party)
          : s.party;

      const partyIds = newParty.map((p) => p.id);
      const tankId = newParty.find((p) => p.badge === 'MT' || p.badge === 'OT')?.id;

      const importedMechs = payload.mechanics.map((m, i) => {
        const seenCount = m.targetNames.length;
        let targets: string[];
        if (seenCount >= newParty.length - 1) targets = partyIds; // raidwide-ish
        else if (seenCount === 1) targets = tankId ? [tankId] : [];
        else targets = []; // user to assign
        const laneId = (m.source_name && nameToLane.get(m.source_name)) ?? fallbackLaneId;
        return {
          id: `mech-fflogs-${Date.now()}-${i}`,
          lane_id: laneId,
          name: m.name.toUpperCase(),
          // Mech labels render in UPPERCASE ; we mirror that on the FR
          // name so the lang toggle doesn't visually shrink the label.
          name_fr: m.name_fr ? m.name_fr.toUpperCase() : undefined,
          game_id: m.game_id,
          time: m.time,
          category: 'damage' as const,
          targets,
          damage_kind: m.damage_kind,
          // hit_count stored separately ; rendered as a ×N superscript
          // over the cap instead of glued to the name.
          hit_count: m.hit_count && m.hit_count > 1 ? m.hit_count : undefined,
          cast_time: m.cast_time && m.cast_time > 0 ? m.cast_time : undefined,
        };
      });
      // Standalone boss casts → 'cast' category mechs. No targets /
      // damage_kind : they're non-mitigable cues (what players read off
      // the boss cast bar), shown alongside the damage mechs with their
      // own VIEW toggle.
      const importedCasts: Mechanic[] = (payload.bossCasts ?? []).map((c, i) => ({
        id: `mech-fflogs-cast-${Date.now()}-${i}`,
        lane_id: (c.source_name && nameToLane.get(c.source_name)) ?? fallbackLaneId,
        name: c.name.toUpperCase(),
        name_fr: c.name_fr ? c.name_fr.toUpperCase() : undefined,
        game_id: c.game_id,
        time: c.time,
        category: 'cast' as const,
        targets: [],
        cast_time: c.cast_time && c.cast_time > 0 ? c.cast_time : undefined,
        // ×N badge when the server collapsed repeated casts (Hyperpulse…).
        hit_count: c.hit_count && c.hit_count > 1 ? c.hit_count : undefined,
      }));
      // Rebuild uses[] from friendly cast events. Each cast resolves to
      // a Use iff :
      //   - playerName matches one of newParty's player names (exact)
      //   - the player's job has an ability with `action_id === actionId`
      // Cast events that don't resolve (damage abilities, heals, items,
      // unknown subjobs, …) are silently dropped — that's expected
      // because our seed only catalogs defensives.
      const importedUses: Use[] = [];
      if (payload.playerUses && payload.playerUses.length > 0 && s.jobs.length > 0) {
        const playerByName = new Map<string, Player>();
        for (const p of newParty) playerByName.set(p.name, p);
        const jobByCode = new Map<string, Job>();
        for (const j of s.jobs) jobByCode.set(j.code, j);
        let idx = 0;
        // Dedup near-duplicate casts (begincast/cast pairs survive the
        // server-side filter only as cast, but a player can also
        // legitimately recast the same instant ability twice in <500ms
        // — extremely unlikely but cheap to guard against). Keyed by
        // (player_id, ability_id, floor(time / 0.5s)).
        const seen = new Set<string>();
        for (const pu of payload.playerUses) {
          const player = playerByName.get(pu.playerName);
          if (!player) continue;
          const job = jobByCode.get(player.job);
          if (!job) continue;
          // Match against the base action id AND every level-variant
          // form : a lvl-70 log casts Sheltron (3542) while a lvl-100
          // log casts Holy Sheltron (25746) — both must map onto the
          // same PLD.Sheltron row.
          const ab = job.abilities.find(
            (a) =>
              a.action_id === pu.actionId ||
              (a.level_variants &&
                Object.values(a.level_variants).some((v) => v?.action_id === pu.actionId)),
          );
          if (!ab) continue;
          const dedupKey = `${player.id}|${ab.id}|${Math.floor(pu.time * 2)}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          importedUses.push({
            id: `use-fflogs-${Date.now()}-${idx++}`,
            player_id: player.id,
            ability_id: ab.id,
            time: pu.time,
          });
        }
      }

      // Clamp imported level to the brackets we support : 50, 60, 70,
      // 80, 90, 100. Anything outside that range falls back to 100.
      const VALID_LEVELS = [50, 60, 70, 80, 90, 100];
      const importedLevel =
        payload.gameLevel && VALID_LEVELS.includes(payload.gameLevel)
          ? payload.gameLevel
          : s.encounter.level;
      return {
        encounter: {
          ...s.encounter,
          fight_name: payload.fightName,
          fight_duration: Math.max(60, Math.min(900, payload.fightDuration)),
          level: importedLevel,
        },
        party: newParty,
        bossLanes: lanes,
        mechanics: [...importedMechs, ...importedCasts],
        uses: importedUses,
        // Phase markers from a previous fight don't line up with the
        // freshly imported timeline — start clean.
        phases: [],
        // An imported log = one pull. Replace any existing variants with
        // a single fresh one (multi-log import is inc.3, not inc.1).
        ...singleVariant(importedMechs, importedUses),
      };
    }),
  importParty: (newParty) =>
    set((s) => {
      // Map slot-id → old job + new job. Slots that didn't change job
      // skip the remap and keep their uses as-is.
      const newById = new Map(newParty.map((p) => [p.id, p]));
      const remapUses = (uses: Use[]): Use[] => {
        const out: Use[] = [];
        for (const u of uses) {
          const oldPlayer = s.party.find((p) => p.id === u.player_id);
          const newPlayer = newById.get(u.player_id);
          if (!newPlayer) continue; // slot disappeared (unlikely with 8 fixed slots)
          if (oldPlayer && oldPlayer.job === newPlayer.job) {
            out.push(u);
            continue;
          }
          const oldJob = s.jobs.find((j) => j.code === oldPlayer?.job);
          const newJob = s.jobs.find((j) => j.code === newPlayer.job);
          if (!oldJob || !newJob) continue;
          const oldAb = oldJob.abilities.find((a) => a.id === u.ability_id);
          if (!oldAb) continue;
          const matchAb = newJob.abilities.find((a) => a.name === oldAb.name);
          if (matchAb) out.push({ ...u, ability_id: matchAb.id });
        }
        return out;
      };
      // The party is shared across all variants — remap every variant's
      // uses, not just the active one, so an inactive pull doesn't keep
      // dangling references to the old job's abilities.
      const variants = syncActiveVariant(s.variants, s.activeVariantId, s.mechanics, s.uses)
        .map((v) => ({ ...v, uses: remapUses(v.uses) }));
      const active = variants.find((v) => v.id === s.activeVariantId);
      return { party: newParty, variants, uses: active ? active.uses : remapUses(s.uses) };
    }),
  switchPlayerJob: (playerId, newJobCode) =>
    set((s) => {
      const player = s.party.find((p) => p.id === playerId);
      if (!player || player.job === newJobCode) return {};
      const oldJob = s.jobs.find((j) => j.code === player.job);
      const newJob = s.jobs.find((j) => j.code === newJobCode);
      if (!oldJob || !newJob) return {};

      const remapUses = (uses: Use[]): Use[] => {
        const out: Use[] = [];
        for (const u of uses) {
          if (u.player_id !== playerId) {
            out.push(u);
            continue;
          }
          const oldAb = oldJob.abilities.find((a) => a.id === u.ability_id);
          if (!oldAb) continue;
          const matchAb = newJob.abilities.find((a) => a.name === oldAb.name);
          if (matchAb) out.push({ ...u, ability_id: matchAb.id });
          // else: ability not in new job → drop the use silently
        }
        return out;
      };
      // Party is shared : remap this player's uses in every variant.
      const variants = syncActiveVariant(s.variants, s.activeVariantId, s.mechanics, s.uses)
        .map((v) => ({ ...v, uses: remapUses(v.uses) }));
      const active = variants.find((v) => v.id === s.activeVariantId);

      return {
        party: s.party.map((p) => (p.id === playerId ? { ...p, job: newJobCode } : p)),
        variants,
        uses: active ? active.uses : remapUses(s.uses),
      };
    }),

  addVariant: () =>
    set((s) => {
      const synced = syncActiveVariant(s.variants, s.activeVariantId, s.mechanics, s.uses);
      const active = synced.find((v) => v.id === s.activeVariantId) ?? synced[0]!;
      const id = `variant-${Date.now()}`;
      const dup = duplicateVariant(active, id, nextVariantName(synced));
      return {
        variants: [...synced, dup],
        activeVariantId: id,
        mechanics: dup.mechanics,
        uses: dup.uses,
      };
    }),
  removeVariant: (id) =>
    set((s) => {
      if (s.variants.length <= 1) return {}; // never drop the last pull
      const synced = syncActiveVariant(s.variants, s.activeVariantId, s.mechanics, s.uses);
      const remaining = synced.filter((v) => v.id !== id);
      if (remaining.length === synced.length) return {}; // unknown id
      // Removing the active variant → fall back to the first remaining.
      if (id === s.activeVariantId) {
        const next = remaining[0]!;
        return {
          variants: remaining,
          activeVariantId: next.id,
          mechanics: next.mechanics,
          uses: next.uses,
        };
      }
      return { variants: remaining };
    }),
  renameVariant: (id, name) =>
    set((s) => ({
      variants: s.variants.map((v) => (v.id === id ? { ...v, name } : v)),
    })),
  switchVariant: (id) =>
    set((s) => {
      if (id === s.activeVariantId) return {};
      const synced = syncActiveVariant(s.variants, s.activeVariantId, s.mechanics, s.uses);
      const target = synced.find((v) => v.id === id);
      if (!target) return {};
      return {
        variants: synced,
        activeVariantId: id,
        mechanics: target.mechanics,
        uses: target.uses,
      };
    }),

  addBossLane: () =>
    set((s) => {
      const next = String.fromCharCode(65 + s.bossLanes.length); // A→B→C...
      return {
        bossLanes: [...s.bossLanes, { id: `lane-${s.bossLanes.length + 1}`, name: `BOSS ${next}` }],
      };
    }),
  removeBossLane: (id) =>
    set((s) => ({
      bossLanes: s.bossLanes.filter((l) => l.id !== id),
      mechanics: s.mechanics.filter((m) => m.lane_id !== id),
    })),
  setBossLaneName: (id, name) =>
    set((s) => ({ bossLanes: s.bossLanes.map((l) => (l.id === id ? { ...l, name } : l)) })),
  mergeBossLanes: (fromId, toId) =>
    set((s) => {
      if (fromId === toId) return {};
      const from = s.bossLanes.find((l) => l.id === fromId);
      const to = s.bossLanes.find((l) => l.id === toId);
      if (!from || !to) return {};
      return {
        bossLanes: s.bossLanes.filter((l) => l.id !== fromId),
        mechanics: s.mechanics.map((m) =>
          m.lane_id === fromId ? { ...m, lane_id: toId } : m,
        ),
      };
    }),
  moveBossLane: (id, dir) =>
    set((s) => {
      const idx = s.bossLanes.findIndex((l) => l.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= s.bossLanes.length) return {};
      const bossLanes = [...s.bossLanes];
      [bossLanes[idx], bossLanes[j]] = [bossLanes[j]!, bossLanes[idx]!];
      return { bossLanes };
    }),

  addPhase: () =>
    set((s) => {
      const additions: Phase[] = [];
      // Anchor the start of the fight as a real phase : inserting a "P2"
      // shouldn't leave the opening stretch as an unnamed, uncolored
      // region. Only kicks in when phases already exist but none sits at
      // the very start (e.g. the first marker was dragged off 0:00).
      const hasStart = s.phases.some((p) => p.time <= 0);
      if (s.phases.length > 0 && !hasStart) {
        additions.push({ id: `phase-${Date.now()}-start`, name: 'P1', time: 0 });
      }
      const base = [...s.phases, ...additions];
      // New phase lands 60s after the last one (or at 0:00 for the very
      // first) — the user drags the marker where they want it.
      const last = base.reduce((mx, p) => Math.max(mx, p.time), -60);
      const time = Math.min(s.encounter.fight_duration - 5, last + 60);
      additions.push({
        id: `phase-${Date.now()}-${base.length}`,
        name: `P${base.length + 1}`,
        time: Math.max(0, time),
      });
      return { phases: [...s.phases, ...additions] };
    }),
  removePhase: (id) => set((s) => ({ phases: s.phases.filter((p) => p.id !== id) })),
  setPhaseName: (id, name) =>
    set((s) => ({ phases: s.phases.map((p) => (p.id === id ? { ...p, name } : p)) })),
  movePhase: (id, time) =>
    set((s) => ({
      phases: s.phases.map((p) =>
        p.id === id ? { ...p, time: Math.max(0, Math.min(s.encounter.fight_duration, time)) } : p,
      ),
    })),

  openMechanicModal: (laneId, time, init) =>
    set((s) => ({
      mechanicModal: {
        mode: 'create',
        laneId,
        time,
        name: init?.name ?? '',
        category: init?.category ?? 'damage',
        // Pre-check every party member by default — most mechs at the
        // planner's level are raidwides, and unchecking is fast.
        targets: init?.targets ?? s.party.map((p) => p.id),
        damage_kind: init?.damage_kind ?? 'magical',
        cast_time: init?.cast_time ?? 0,
        tags: [],
      },
    })),
  openEditMechanic: (m) =>
    set((s) => ({
      mechanicModal: {
        mode: 'edit',
        mechanicId: m.id,
        laneId: m.lane_id,
        time: m.time,
        // Pre-fill with the LOCALIZED name (what the user sees on the
        // timeline). AddMechanicModal only persists a rename when the
        // field actually changed from this value.
        name: s.lang === 'fr' && m.name_fr ? m.name_fr : m.name,
        category: m.category,
        targets: [...m.targets],
        damage_kind: m.damage_kind ?? 'magical',
        cast_time: m.cast_time ?? 0,
        tags: [...(m.tags ?? [])],
      },
    })),
  setMechanicModal: (patch) =>
    set((s) => (s.mechanicModal ? { mechanicModal: { ...s.mechanicModal, ...patch } } : {})),
  closeMechanicModal: () => set({ mechanicModal: null }),

  setDragCtx: (dragCtx) => set({ dragCtx }),

  setPreviewUse: (previewUse) => set({ previewUse }),

  addMechanic: (m) => set((s) => ({ mechanics: [...s.mechanics, m] })),
  removeMechanic: (id) => set((s) => ({ mechanics: s.mechanics.filter((m) => m.id !== id) })),
  moveMechanic: (id, time) =>
    set((s) => ({ mechanics: s.mechanics.map((m) => (m.id === id ? { ...m, time } : m)) })),
  updateMechanic: (id, patch) =>
    set((s) => ({
      mechanics: s.mechanics.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  addUse: (u) => set((s) => ({ uses: [...s.uses, u] })),
  removeUse: (id) => set((s) => ({ uses: s.uses.filter((u) => u.id !== id) })),
  moveUse: (id, time) =>
    set((s) => ({
      uses: s.uses.map((u) => (u.id === id ? { ...u, time } : u)),
    })),

  toggleAbilityHidden: (abilityId) =>
    set((s) => {
      const has = s.hiddenAbilityIds.includes(abilityId);
      return {
        hiddenAbilityIds: has
          ? s.hiddenAbilityIds.filter((id) => id !== abilityId)
          : [...s.hiddenAbilityIds, abilityId],
        // Drop any existing uses for the now-hidden ability so they
        // don't keep counting toward coverage from an invisible row.
        uses: has ? s.uses : s.uses.filter((u) => u.ability_id !== abilityId),
      };
    }),
  setHiddenAbilityIds: (ids) => set({ hiddenAbilityIds: ids }),

  toggleCollapsed: (playerId) =>
    set((s) => ({ collapsed: { ...s.collapsed, [playerId]: !s.collapsed[playerId] } })),
  expandPlayer: (playerId) =>
    set((s) => ({ collapsed: { ...s.collapsed, [playerId]: false } })),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(8, zoom)) }),
  toggleMechCategoryVisibility: (cat) =>
    set((s) => ({
      hiddenMechCategories: s.hiddenMechCategories.includes(cat)
        ? s.hiddenMechCategories.filter((c) => c !== cat)
        : [...s.hiddenMechCategories, cat],
    })),
  toggleCompactMechs: () => set((s) => ({ compactMechs: !s.compactMechs })),

  resetEncounter: () =>
    set({
      mechanics: [],
      uses: [],
      phases: [],
      bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
      ...singleVariant([], []),
    }),

  setSlug: (slug) => set({ slug }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setReadOnly: (readOnly) => set({ readOnly }),
  setLang: (lang) => {
    storeLang(lang);
    set({ lang });
  },
  setOrientation: (orientation) => {
    storeOrientation(orientation);
    set({ orientation });
  },
  toggleOrientation: () =>
    set((s) => {
      const orientation: Orientation =
        s.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      storeOrientation(orientation);
      return { orientation };
    }),
  restoreSnapshot: (snap) =>
    set({
      encounter: snap.encounter,
      party: snap.party,
      bossLanes: snap.bossLanes,
      mechanics: snap.mechanics,
      uses: snap.uses,
      hiddenAbilityIds: snap.hiddenAbilityIds,
      phases: snap.phases,
      // The snapshot already synced the active variant's data into
      // `variants` at capture time, so restoring all of them keeps the
      // top-level mechanics/uses == variants[active] invariant.
      variants: snap.variants,
      activeVariantId: snap.activeVariantId,
      // Don't touch transient UI ; undo a placement shouldn't reopen a modal.
    }),
  hydratePlan: (plan) =>
    set((s) => {
      const mechanics = plan.mechanics ?? s.mechanics;
      const uses = plan.uses ?? s.uses;
      // `variants` is the source of truth when present ; legacy plans are
      // migrated into a single variant carrying mechanics/uses. The active
      // variant's data becomes the live top-level surface.
      const { variants, activeVariantId } = ensureVariants(mechanics, uses, plan.variants);
      const active = variants.find((v) => v.id === activeVariantId);
      return {
        slug: plan.meta?.slug ?? s.slug,
        // Backfill defaults for any field a legacy server-stored plan
        // might lack (added later than the field's existence in code) —
        // the runtime payload can have an undefined `level` even though
        // the TS type marks it required.
        encounter: plan.encounter
          ? { ...plan.encounter, level: plan.encounter.level ?? 100 }
          : s.encounter,
        party: plan.party ?? s.party,
        bossLanes: plan.boss_lanes ?? s.bossLanes,
        mechanics: active ? active.mechanics : mechanics,
        uses: active ? active.uses : uses,
        hiddenAbilityIds: plan.hidden_ability_ids ?? [],
        phases: plan.phases ?? [],
        variants,
        activeVariantId,
        // Reset transient UI so a stale modal/preview doesn't leak across loads
        mechanicModal: null,
        dragCtx: null,
        previewUse: null,
        saveStatus: 'saved',
        _skipNextSave: true,
      };
    }),
}));

/** Convenience selector: find an ability across all jobs (O(jobs+abilities), fine at ~150). */
export function findAbility(jobs: Job[], abilityId: string) {
  for (const job of jobs) {
    const ab = job.abilities.find((a) => a.id === abilityId);
    if (ab) return { job, ability: ab };
  }
  return null;
}
