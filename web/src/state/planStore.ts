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
import type { BossLane, DamageKind, Encounter, Job, MechCategory, MechType, Mechanic, Player, Use } from '../types';
import { demoParty } from '../data/demoParty';
import { loadStoredLang, storeLang, type Lang } from '../i18n';

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

  // Plan content
  encounter: Encounter;
  party: Player[];
  bossLanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];

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
    /** Ordered boss lane names from the FFLogs source analysis. One
     *  BossLane is created per entry (e.g. ["Shinryu", "Right Wing",
     *  "Left Wing", "Adds"]). If the array is empty, falls back to a
     *  single "BOSS A" lane. */
    bossLanes?: string[];
    mechanics: Array<{
      name: string;
      time: number;
      targetNames: string[];
      damage_kind: 'physical' | 'magical' | 'pure';
      source_name?: string;
      hit_count?: number;
    }>;
  }): void;
  /**
   * Switch a player to a new job. Uses are remapped by ability NAME:
   * shared abilities (Reprisal, Rampart, Arm's Length, ...) survive
   * because every job has its own copy under the same name. Job-specific
   * abilities (Hallowed Ground on PLD, Holmgang on WAR, ...) are dropped.
   */
  switchPlayerJob(playerId: string, newJobCode: string): void;

  // Actions — boss lanes
  addBossLane(): void;
  removeBossLane(id: string): void;
  setBossLaneName(id: string, name: string): void;

  // Actions — modal
  openMechanicModal(
    laneId: string,
    time: number,
    init?: {
      category?: MechCategory;
      targets?: string[];
      damage_kind?: DamageKind;
      name?: string;
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

  // Actions — UI
  toggleCollapsed(playerId: string): void;
  expandPlayer(playerId: string): void;
  setZoom(zoom: number): void;
  toggleMechCategoryVisibility(cat: MechCategory): void;

  // Actions — reset
  resetEncounter(): void;

  // Actions — persistence (C.5) + history (M.3) + view mode (M.4)
  setSlug(slug: string | null): void;
  setSaveStatus(status: SaveStatus): void;
  setReadOnly(readOnly: boolean): void;
  setLang(lang: Lang): void;
  /** Used by historyManager to swap back to a past snapshot. */
  restoreSnapshot(snap: {
    encounter: Encounter;
    party: Player[];
    bossLanes: BossLane[];
    mechanics: Mechanic[];
    uses: Use[];
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
  }): void;
}

const defaultEncounter: Encounter = {
  fight_name: 'M3S — Brute Abominator',
  fight_duration: 600,
  party_ilvl: 735,
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
  encounter: defaultEncounter,
  party: demoParty,
  bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
  mechanics: [],
  uses: [],
  collapsed: {},
  zoom: 2,
  hiddenMechCategories: [],

  setJobs: (jobs) => set({ jobs, jobsLoading: false, jobsError: null }),
  setJobsError: (jobsError) => set({ jobsError, jobsLoading: false }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),

  setEncounter: (patch) => set((s) => ({ encounter: { ...s.encounter, ...patch } })),

  setParty: (party) => set({ party }),
  setPlayerName: (playerId, name) =>
    set((s) => ({ party: s.party.map((p) => (p.id === playerId ? { ...p, name } : p)) })),
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

      const partyIds = s.party.map((p) => p.id);
      const tankId = s.party.find((p) => p.badge === 'MT' || p.badge === 'OT')?.id;

      const importedMechs = payload.mechanics.map((m, i) => {
        const seenCount = m.targetNames.length;
        let targets: string[];
        if (seenCount >= s.party.length - 1) targets = partyIds; // raidwide-ish
        else if (seenCount === 1) targets = tankId ? [tankId] : [];
        else targets = []; // user to assign
        const laneId = (m.source_name && nameToLane.get(m.source_name)) ?? fallbackLaneId;
        // Append the hit count when > 1 so multi-hit casts (Akh Morn ×5,
        // Electrocution ×3 ticks) read clearly in the timeline.
        const hitSuffix = m.hit_count && m.hit_count > 1 ? ` ×${m.hit_count}` : '';
        return {
          id: `mech-fflogs-${Date.now()}-${i}`,
          lane_id: laneId,
          name: m.name.toUpperCase() + hitSuffix,
          time: m.time,
          category: 'damage' as const,
          targets,
          damage_kind: m.damage_kind,
        };
      });
      return {
        encounter: {
          ...s.encounter,
          fight_name: payload.fightName,
          fight_duration: Math.max(60, Math.min(900, payload.fightDuration)),
        },
        bossLanes: lanes,
        mechanics: importedMechs,
        uses: [], // can't auto-place ; clear to start from scratch
      };
    }),
  importParty: (newParty) =>
    set((s) => {
      // Map slot-id → old job + new job. Slots that didn't change job
      // skip the remap and keep their uses as-is.
      const newById = new Map(newParty.map((p) => [p.id, p]));
      const remappedUses: Use[] = [];
      for (const u of s.uses) {
        const oldPlayer = s.party.find((p) => p.id === u.player_id);
        const newPlayer = newById.get(u.player_id);
        if (!newPlayer) continue; // slot disappeared (unlikely with 8 fixed slots)
        if (oldPlayer && oldPlayer.job === newPlayer.job) {
          remappedUses.push(u);
          continue;
        }
        const oldJob = s.jobs.find((j) => j.code === oldPlayer?.job);
        const newJob = s.jobs.find((j) => j.code === newPlayer.job);
        if (!oldJob || !newJob) continue;
        const oldAb = oldJob.abilities.find((a) => a.id === u.ability_id);
        if (!oldAb) continue;
        const matchAb = newJob.abilities.find((a) => a.name === oldAb.name);
        if (matchAb) remappedUses.push({ ...u, ability_id: matchAb.id });
      }
      return { party: newParty, uses: remappedUses };
    }),
  switchPlayerJob: (playerId, newJobCode) =>
    set((s) => {
      const player = s.party.find((p) => p.id === playerId);
      if (!player || player.job === newJobCode) return {};
      const oldJob = s.jobs.find((j) => j.code === player.job);
      const newJob = s.jobs.find((j) => j.code === newJobCode);
      if (!oldJob || !newJob) return {};

      const remappedUses: Use[] = [];
      for (const u of s.uses) {
        if (u.player_id !== playerId) {
          remappedUses.push(u);
          continue;
        }
        const oldAb = oldJob.abilities.find((a) => a.id === u.ability_id);
        if (!oldAb) continue;
        const matchAb = newJob.abilities.find((a) => a.name === oldAb.name);
        if (matchAb) remappedUses.push({ ...u, ability_id: matchAb.id });
        // else: ability not in new job → drop the use silently
      }

      return {
        party: s.party.map((p) => (p.id === playerId ? { ...p, job: newJobCode } : p)),
        uses: remappedUses,
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
      },
    })),
  openEditMechanic: (m) =>
    set({
      mechanicModal: {
        mode: 'edit',
        mechanicId: m.id,
        laneId: m.lane_id,
        time: m.time,
        name: m.name,
        category: m.category,
        targets: [...m.targets],
        damage_kind: m.damage_kind ?? 'magical',
      },
    }),
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

  resetEncounter: () =>
    set({
      mechanics: [],
      uses: [],
      bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
    }),

  setSlug: (slug) => set({ slug }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setReadOnly: (readOnly) => set({ readOnly }),
  setLang: (lang) => {
    storeLang(lang);
    set({ lang });
  },
  restoreSnapshot: (snap) =>
    set({
      encounter: snap.encounter,
      party: snap.party,
      bossLanes: snap.bossLanes,
      mechanics: snap.mechanics,
      uses: snap.uses,
      // Don't touch transient UI ; undo a placement shouldn't reopen a modal.
    }),
  hydratePlan: (plan) =>
    set((s) => ({
      slug: plan.meta?.slug ?? s.slug,
      encounter: plan.encounter ?? s.encounter,
      party: plan.party ?? s.party,
      bossLanes: plan.boss_lanes ?? s.bossLanes,
      mechanics: plan.mechanics ?? s.mechanics,
      uses: plan.uses ?? s.uses,
      // Reset transient UI so a stale modal/preview doesn't leak across loads
      mechanicModal: null,
      dragCtx: null,
      previewUse: null,
      saveStatus: 'saved',
      _skipNextSave: true,
    })),
}));

/** Convenience selector: find an ability across all jobs (O(jobs+abilities), fine at ~150). */
export function findAbility(jobs: Job[], abilityId: string) {
  for (const job of jobs) {
    const ab = job.abilities.find((a) => a.id === abilityId);
    if (ab) return { job, ability: ab };
  }
  return null;
}
