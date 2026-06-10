/** Format seconds as "M:SS" (e.g. 75 → "1:15"). */
export function fmt(t: number): string {
  const mm = Math.floor(t / 60);
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Parse "M:SS" or plain seconds string into number. Empty/invalid → 0. */
export function parseTime(str: string): number {
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]!, 10);
    const s = parseInt(parts[1]!, 10);
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
  }
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Time as percentage of fight duration (clamped 0–100). */
export function pct(t: number, fightDuration: number): number {
  if (fightDuration <= 0) return 0;
  return Math.max(0, Math.min(100, (t / fightDuration) * 100));
}

/** A duration of `seconds` as a percentage of the fight (unclamped low,
 *  capped at 100). Used for recast/cast-bar spans along the time axis —
 *  the same math whether that span renders as a width (horizontal) or a
 *  height (vertical). */
export function spanPct(seconds: number, fightDuration: number): number {
  if (fightDuration <= 0) return 0;
  return Math.min(100, (seconds / fightDuration) * 100);
}

/** Map a 0–1 fraction of the time axis to a rounded, clamped timestamp.
 *  Pure (no DOM) so both xToTime and yToTime share — and test — it. */
export function ratioToTime(ratio: number, fightDuration: number): number {
  return Math.max(0, Math.min(fightDuration, Math.round(ratio * fightDuration)));
}

/** Inverse (horizontal): pixel X within an element → time clamped to [0, dur]. */
export function xToTime(clientX: number, el: HTMLElement, fightDuration: number): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return ratioToTime((clientX - rect.left) / rect.width, fightDuration);
}

/** Inverse (vertical): pixel Y within an element → time clamped to [0, dur].
 *  The time axis runs top→bottom, so the top edge is t=0. */
export function yToTime(clientY: number, el: HTMLElement, fightDuration: number): number {
  const rect = el.getBoundingClientRect();
  if (rect.height <= 0) return 0;
  return ratioToTime((clientY - rect.top) / rect.height, fightDuration);
}
