/**
 * Snapshot-based undo/redo for the plan store.
 *
 * On every change to the persistable slices (encounter, party,
 * bossLanes, mechanics, uses), the PREVIOUS snapshot is pushed onto
 * the history stack. Ctrl+Z pops it and restores; Ctrl+Y / Ctrl+Shift+Z
 * pushes back through the future stack.
 *
 * Reference equality on the slice tuple is enough to detect persistable
 * changes — every store action that touches a persistable slice returns
 * a new object/array reference. Transient state (previewUse, dragCtx,
 * mechanicModal, …) doesn't share references with these slices, so
 * those changes don't trigger snapshots.
 *
 * The manager survives across renders because it lives at module scope.
 * App.tsx calls initHistory() in a useEffect with cleanup so the
 * subscription is tied to the app's lifetime in dev (StrictMode-safe).
 */

import type { BossLane, Encounter, Mechanic, Phase, Player, Use } from '../types';
import { usePlanStore } from './planStore';

interface Snapshot {
  encounter: Encounter;
  party: Player[];
  bossLanes: BossLane[];
  mechanics: Mechanic[];
  uses: Use[];
  hiddenAbilityIds: string[];
  phases: Phase[];
}

const HISTORY_CAP = 100;

let history: Snapshot[] = [];
let future: Snapshot[] = [];
let prev: Snapshot | null = null;
/** Set just before restoreSnapshot fires, consumed by the subscriber so
 *  the resulting state change doesn't push itself onto history. */
let suppressNext = false;
/** Active subscriber's unsubscribe handle (so re-mounts don't dup-stack). */
let unsub: (() => void) | null = null;

function capture(): Snapshot {
  const s = usePlanStore.getState();
  return {
    encounter: { ...s.encounter },
    party: s.party.map((p) => ({ ...p })),
    bossLanes: s.bossLanes.map((l) => ({ ...l })),
    mechanics: s.mechanics.map((m) => ({ ...m, targets: [...m.targets] })),
    uses: s.uses.map((u) => ({ ...u })),
    hiddenAbilityIds: [...s.hiddenAbilityIds],
    phases: s.phases.map((p) => ({ ...p })),
  };
}

/**
 * Initialize the history subscriber. Returns a cleanup callback for
 * useEffect. Idempotent: a second init() while one is active replaces
 * the prior subscriber.
 */
export function initHistory(): () => void {
  if (unsub) unsub();
  prev = capture();
  history = [];
  future = [];
  unsub = usePlanStore.subscribe((state, prevState) => {
    // Reference compare on the 5 persistable slices.
    const changed =
      state.encounter !== prevState.encounter ||
      state.party !== prevState.party ||
      state.bossLanes !== prevState.bossLanes ||
      state.mechanics !== prevState.mechanics ||
      state.uses !== prevState.uses ||
      state.hiddenAbilityIds !== prevState.hiddenAbilityIds ||
      state.phases !== prevState.phases;
    if (!changed) return;
    if (suppressNext) {
      suppressNext = false;
      prev = capture();
      return;
    }
    if (prev) {
      history.push(prev);
      if (history.length > HISTORY_CAP) history.shift();
    }
    future = [];
    prev = capture();
  });
  return () => {
    if (unsub) {
      unsub();
      unsub = null;
    }
  };
}

export function undo(): boolean {
  if (history.length === 0) return false;
  const target = history.pop()!;
  if (prev) future.push(prev);
  suppressNext = true;
  usePlanStore.getState().restoreSnapshot(target);
  prev = target;
  return true;
}

export function redo(): boolean {
  if (future.length === 0) return false;
  const target = future.pop()!;
  if (prev) history.push(prev);
  suppressNext = true;
  usePlanStore.getState().restoreSnapshot(target);
  prev = target;
  return true;
}

export function canUndo(): boolean { return history.length > 0; }
export function canRedo(): boolean { return future.length > 0; }

/** Drops the history stack — called by hydratePlan via PlanLoader so
 *  Ctrl+Z after a fresh server-load doesn't revert to the empty
 *  default state. */
export function resetHistory(): void {
  history = [];
  future = [];
  prev = capture();
}
