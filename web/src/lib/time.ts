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

/** Inverse: pixel offset within an element → time clamped to [0, fightDuration]. */
export function xToTime(clientX: number, el: HTMLElement, fightDuration: number): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(fightDuration, Math.round(ratio * fightDuration)));
}
