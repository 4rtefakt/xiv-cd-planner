/**
 * Cyberpunk-styled SVG glyphs ported from the V0.4 mockup's <defs> sprite.
 * Used as fallback icons until / unless real PNG/SVG ability icons are
 * vendored under /icons/abilities. Each glyph is rendered as a single
 * `<svg viewBox>` element styled to fill its parent's `color`.
 *
 * - Job glyphs (JOB_GLYPHS): keyed by 3-letter job code.
 * - Ability glyphs (ABILITY_GLYPHS): keyed by a small set of symbolic
 *   names ('shield', 'aegis', 'cross', etc.) referenced from
 *   seed/data.json `icon` fields.
 */

import type { ReactNode } from 'react';

type Glyph = (color?: string) => ReactNode;

export const JOB_GLYPHS: Record<string, Glyph> = {
  PLD: (c = '#2b9eff') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M16 3 L27 8 L27 17 C27 23 22 28 16 30 C10 28 5 23 5 17 L5 8 Z" fill="none" stroke={c} strokeWidth="2" />
      <path d="M16 9 L16 23 M11 16 L21 16" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  WAR: (c = '#2b9eff') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M8 6 L24 6 L26 12 L20 16 L26 20 L24 26 L8 26 L6 20 L12 16 L6 12 Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2" fill={c} />
    </svg>
  ),
  WHM: (c = '#4ade80') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <circle cx="16" cy="16" r="11" fill="none" stroke={c} strokeWidth="2" />
      <path d="M16 7 L16 25 M7 16 L25 16 M10 10 L22 22 M22 10 L10 22" stroke={c} strokeWidth="1.2" opacity="0.6" />
      <circle cx="16" cy="16" r="3" fill={c} />
    </svg>
  ),
  SCH: (c = '#4ade80') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <rect x="6" y="6" width="20" height="20" fill="none" stroke={c} strokeWidth="2" />
      <path d="M11 11 L21 11 M11 16 L21 16 M11 21 L17 21" stroke={c} strokeWidth="1.5" />
      <circle cx="22" cy="22" r="2" fill={c} />
    </svg>
  ),
  SAM: (c = '#ff4f6e') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M5 27 L27 5 M5 27 L11 27 L27 11 L27 5" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 18 L18 22" stroke={c} strokeWidth="1.5" />
    </svg>
  ),
  DRG: (c = '#ff4f6e') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M16 4 L22 12 L20 28 L12 28 L10 12 Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 10 L16 24 M12 16 L20 16" stroke={c} strokeWidth="1.2" />
    </svg>
  ),
  BRD: (c = '#ff4f6e') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M16 4 C9 4 5 11 5 18 C5 23 8 27 12 27" fill="none" stroke={c} strokeWidth="2" />
      <path d="M16 4 C23 4 27 11 27 18 C27 23 24 27 20 27" fill="none" stroke={c} strokeWidth="2" />
      <path d="M12 27 L20 27" stroke={c} strokeWidth="1.5" />
      <path d="M16 8 L16 24" stroke={c} strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  ),
  BLM: (c = '#ff4f6e') => (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
      <path d="M16 4 L26 12 L22 28 L10 28 L6 12 Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="17" r="4" fill="none" stroke={c} strokeWidth="1.5" />
      <circle cx="16" cy="17" r="1.5" fill={c} />
    </svg>
  ),
};

export const ABILITY_GLYPHS: Record<string, Glyph> = {
  shield: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <path d="M12 2 L20 5 L20 12 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 12 L4 5 Z" fill="currentColor" opacity="0.85" />
      <path d="M12 7 L12 17 M8 12 L16 12" stroke="white" strokeWidth="1.5" opacity="0.9" />
    </svg>
  ),
  cross: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.85" />
      <path d="M12 5 L12 19 M5 12 L19 12" stroke="white" strokeWidth="2.5" />
    </svg>
  ),
  aegis: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="currentColor" opacity="0.85" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  sword: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 3 L12 18 M9 6 L15 6 M10 18 L14 18 L12 22 Z" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  star: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 3 L14.5 9.5 L21 10 L16 14.5 L17.5 21 L12 17.5 L6.5 21 L8 14.5 L3 10 L9.5 9.5 Z" fill="white" opacity="0.9" />
    </svg>
  ),
  eye: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M2 12 C5 7 8.5 5 12 5 C15.5 5 19 7 22 12 C19 17 15.5 19 12 19 C8.5 19 5 17 2 12 Z" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="white" />
    </svg>
  ),
  wing: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M3 14 C7 8 14 6 21 8 M3 14 C8 13 14 13 19 16 M3 14 L3 18 L7 17" fill="none" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  diamond: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="white" strokeWidth="2" />
      <path d="M12 8 L16 12 L12 16 L8 12 Z" fill="white" opacity="0.9" />
    </svg>
  ),
  triangle: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 4 L21 20 L3 20 Z" fill="none" stroke="white" strokeWidth="1.8" />
      <path d="M12 11 L12 17" stroke="white" strokeWidth="2" />
    </svg>
  ),
  note: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M9 17 C9 18.5 10.5 19.5 12 19.5 C13.5 19.5 14.5 18.5 14.5 17 C14.5 15.5 13.5 14.5 12 14.5 C10.5 14.5 9 15.5 9 17 Z M14.5 17 L14.5 5 L19 4 L19 7 L14.5 7" fill="none" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  hex: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 3 L20 7 L20 17 L12 21 L4 17 L4 7 Z" fill="none" stroke="white" strokeWidth="1.8" />
      <path d="M12 3 L12 21 M4 7 L20 17 M20 7 L4 17" stroke="white" strokeWidth="0.6" opacity="0.5" />
    </svg>
  ),
  soil: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M4 17 L20 17 M6 17 C6 13 9 10 12 10 C15 10 18 13 18 17" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="12" cy="6" r="2" fill="white" />
    </svg>
  ),
  heart: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 20 C8 16 4 13 4 9 C4 6 6.5 4 9 4 C10.5 4 12 5 12 6.5 C12 5 13.5 4 15 4 C17.5 4 20 6 20 9 C20 13 16 16 12 20 Z" fill="white" opacity="0.95" />
    </svg>
  ),
  spark: () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <rect width="24" height="24" fill="currentColor" opacity="0.85" />
      <path d="M12 2 L13.5 10 L21 12 L13.5 14 L12 22 L10.5 14 L3 12 L10.5 10 Z" fill="white" opacity="0.95" />
    </svg>
  ),
};

/** Render a glyph by name, falling back to `shield` if unknown. */
export function abilityGlyph(name: string): ReactNode {
  const fn = ABILITY_GLYPHS[name] ?? ABILITY_GLYPHS.shield!;
  return fn();
}

/** Render a job glyph by 3-letter job code, falling back to PLD. */
export function jobGlyph(code: string): ReactNode {
  const fn = JOB_GLYPHS[code] ?? JOB_GLYPHS.PLD!;
  return fn();
}
