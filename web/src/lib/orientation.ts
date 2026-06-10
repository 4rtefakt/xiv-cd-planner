/**
 * Timeline orientation projection.
 *
 * The timeline has two axes :
 *   - MAIN axis      = time. Horizontal → X, Vertical → Y.
 *   - TRANSVERSE axis = lanes / abilities (the rows or columns).
 *
 * Components that place something *at a time* (a mechanic line, a placed
 * cooldown, a phase marker, an axis tick) only need to know where the
 * main axis points. This module centralises that decision so the markers
 * emit a single time-derived inline style and let the orientation-scoped
 * CSS (.timeline-shell.vertical …) handle the rest of the transposition.
 *
 * Why inline-style and not 100% CSS : the offset depends on `time`, which
 * CSS can't derive from data. Everything that is *constant* per
 * orientation (line direction, cap anchor, label side, scroller axis)
 * lives in components.css instead — see the `.vertical` rules.
 */

import type { CSSProperties } from 'react';
import { pct, spanPct, xToTime, yToTime } from './time';

export type Orientation = 'horizontal' | 'vertical';

/** Position the start of a marker at `time` along the main axis. */
export function mainStart(time: number, fightDuration: number, o: Orientation): CSSProperties {
  const p = `${pct(time, fightDuration)}%`;
  return o === 'vertical' ? { top: p } : { left: p };
}

/** Size a marker that spans `seconds` along the main axis (recast window,
 *  cast bar, …). Horizontal → width, vertical → height. */
export function mainSpan(seconds: number, fightDuration: number, o: Orientation): CSSProperties {
  const p = `${spanPct(seconds, fightDuration)}%`;
  return o === 'vertical' ? { height: p } : { width: p };
}

/** Position + size in one call, for markers that need both (CdUse, cast
 *  bar). The start offset and the span are projected onto the same axis. */
export function mainBlock(
  time: number,
  seconds: number,
  fightDuration: number,
  o: Orientation,
): CSSProperties {
  return { ...mainStart(time, fightDuration, o), ...mainSpan(seconds, fightDuration, o) };
}

/** Size a child as a raw percentage of its PARENT along the main axis —
 *  e.g. a CdUse's active block, which is a fraction of the use, not of
 *  the whole fight. Horizontal → width, vertical → height. */
export function mainExtentPct(percent: number, o: Orientation): CSSProperties {
  const p = `${percent}%`;
  return o === 'vertical' ? { height: p } : { width: p };
}

/** Inverse projection : a pointer position → timestamp, reading the X or
 *  the Y of the event depending on orientation. Centralises the xToTime /
 *  yToTime choice so interaction handlers don't branch inline. */
export function coordToTime(
  clientX: number,
  clientY: number,
  el: HTMLElement,
  fightDuration: number,
  o: Orientation,
): number {
  return o === 'vertical'
    ? yToTime(clientY, el, fightDuration)
    : xToTime(clientX, el, fightDuration);
}

/* ── Persistence ──────────────────────────────────────────────────────
 * Orientation is a per-device UI preference (like `lang`), not part of
 * the shared plan blob — so it lives in localStorage, not the DO. A
 * read-only viewer can flip it without mutating someone else's plan.
 */
const STORAGE_KEY = 'cooldown-planner.orientation';

export function loadStoredOrientation(): Orientation {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'vertical' || v === 'horizontal') return v;
  } catch {
    /* localStorage might be disabled (private mode, sandboxed iframe). */
  }
  return 'horizontal';
}

export function storeOrientation(o: Orientation): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, o);
  } catch {
    /* ignore */
  }
}
