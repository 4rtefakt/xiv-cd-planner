import { useState } from 'react';
import { abilityGlyph, jobGlyph } from '../data/glyphFallbacks';

/**
 * Renders an official icon as <img>, falling back to the cyberpunk SVG
 * glyph on load failure (network down, xivapi rate limit, etc.). The
 * glyph fallback name is taken from the seed's `icon_glyph` field.
 *
 * The image is lazy-loaded — the timeline can render ~150 icons at
 * once and we don't want to block first paint on every one.
 */
interface AbilityIconProps {
  src: string;
  fallbackGlyph: string | undefined;
  alt: string;
  className?: string;
  /** When true, draws no <img> and goes straight to the glyph fallback. */
  forceFallback?: boolean;
}

export function AbilityIcon({ src, fallbackGlyph, alt, className, forceFallback }: AbilityIconProps) {
  const [failed, setFailed] = useState(false);
  if (forceFallback || failed) {
    return <>{abilityGlyph(fallbackGlyph ?? 'shield')}</>;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}

interface JobIconProps {
  src: string;
  fallbackCode: string;
  alt: string;
  className?: string;
}

export function JobIcon({ src, fallbackCode, alt, className }: JobIconProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{jobGlyph(fallbackCode)}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}
