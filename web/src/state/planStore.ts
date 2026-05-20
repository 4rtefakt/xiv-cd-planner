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
import type { BossLane, Encounter, Job, MechType, Mechanic, Player, Use } from '../types';
import { demoParty } from '../data/demoParty';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface MechanicModalState {
  laneId: string;
  time: number;
  type: MechType;
}

/**
 * Shared drag state used by AbilityRow.onDragOver to decide whether to
 * accept a drop. dataTransfer.getData() is unavailable during dragover
 * (only at drop), so we mirror the source's identity here.
 */
export interface DragCtx {
  kind: 'chip' | 'use';
  playerId: string;
  abilityId: string;
  useId?: string;
}

interface PlanState {
  // Modal
  mechanicModal: MechanicModalState | null;
  // Drag
  dragCtx: DragCtx | null;
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

  // Actions — reference
  setJobs(jobs: Job[]): void;
  setJobsError(msg: string | null): void;
  setJobsLoading(loading: boolean): void;

  // Actions — encounter
  setEncounter(patch: Partial<Encounter>): void;

  // Actions — party
  setParty(party: Player[]): void;

  // Actions — boss lanes
  addBossLane(): void;
  removeBossLane(id: string): void;

  // Actions — modal
  openMechanicModal(laneId: string, time: number, type?: MechType): void;
  setMechanicModal(patch: Partial<MechanicModalState>): void;
  closeMechanicModal(): void;

  // Actions — drag
  setDragCtx(ctx: DragCtx | null): void;

  // Actions — mechanics
  addMechanic(m: Mechanic): void;
  removeMechanic(id: string): void;

  // Actions — uses
  addUse(u: Use): void;
  removeUse(id: string): void;
  moveUse(id: string, time: number): void;

  // Actions — UI
  toggleCollapsed(playerId: string): void;
  expandPlayer(playerId: string): void;

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

  setJobs: (jobs) => set({ jobs, jobsLoading: false, jobsError: null }),
  setJobsError: (jobsError) => set({ jobsError, jobsLoading: false }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),

  setEncounter: (patch) => set((s) => ({ encounter: { ...s.encounter, ...patch } })),

  setParty: (party) => set({ party }),

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

  openMechanicModal: (laneId, time, type = 'raidwide') =>
    set({ mechanicModal: { laneId, time, type } }),
  setMechanicModal: (patch) =>
    set((s) => (s.mechanicModal ? { mechanicModal: { ...s.mechanicModal, ...patch } } : {})),
  closeMechanicModal: () => set({ mechanicModal: null }),

  setDragCtx: (dragCtx) => set({ dragCtx }),

  addMechanic: (m) => set((s) => ({ mechanics: [...s.mechanics, m] })),
  removeMechanic: (id) => set((s) => ({ mechanics: s.mechanics.filter((m) => m.id !== id) })),

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
