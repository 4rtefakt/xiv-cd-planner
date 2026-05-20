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
 */
export interface PreviewUse {
  player_id: string;
  ability_id: string;
  time: number;
  conflict: boolean;
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

  // Actions — reset
  resetEncounter(): void;
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
  encounter: defaultEncounter,
  party: demoParty,
  bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
  mechanics: [],
  uses: [],
  collapsed: {},
  zoom: 2,

  setJobs: (jobs) => set({ jobs, jobsLoading: false, jobsError: null }),
  setJobsError: (jobsError) => set({ jobsError, jobsLoading: false }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),

  setEncounter: (patch) => set((s) => ({ encounter: { ...s.encounter, ...patch } })),

  setParty: (party) => set({ party }),
  setPlayerName: (playerId, name) =>
    set((s) => ({ party: s.party.map((p) => (p.id === playerId ? { ...p, name } : p)) })),
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

  resetEncounter: () =>
    set({
      mechanics: [],
      uses: [],
      bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
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
