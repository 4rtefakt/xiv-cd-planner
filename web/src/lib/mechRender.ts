import type { Mechanic } from '../types';
import type { Lang } from '../i18n';

/**
 * Split a mech's display name into (label, hit count). Handles both the
 * NEW shape (m.hit_count stored separately) and the LEGACY shape (the
 * importer used to glue " ×N" at the end of the name). Once all stored
 * plans roll over we can drop the legacy branch.
 *
 * When `lang === 'fr'` and the mech has a French translation, it takes
 * precedence — otherwise we fall back to the imported (English) name.
 *
 * Returns `{ label, hitCount }` where hitCount === 1 means a single
 * hit (no ×N badge needs to render).
 */
export function splitMechName(m: Mechanic, lang: Lang = 'en'): { label: string; hitCount: number } {
  const display = lang === 'fr' && m.name_fr ? m.name_fr : m.name;
  if (m.hit_count != null && m.hit_count > 1) {
    return { label: display, hitCount: m.hit_count };
  }
  const match = display.match(/^(.+?)\s*×(\d+)\s*$/);
  if (match) return { label: match[1]!, hitCount: parseInt(match[2]!, 10) };
  return { label: display, hitCount: 1 };
}
