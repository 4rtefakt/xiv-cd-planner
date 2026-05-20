import type { Mechanic } from '../types';

/**
 * Split a mech's display name into (label, hit count). Handles both the
 * NEW shape (m.hit_count stored separately) and the LEGACY shape (the
 * importer used to glue " ×N" at the end of the name). Once all stored
 * plans roll over we can drop the legacy branch.
 *
 * Returns `{ label, hitCount }` where hitCount === 1 means a single
 * hit (no ×N badge needs to render).
 */
export function splitMechName(m: Mechanic): { label: string; hitCount: number } {
  if (m.hit_count != null && m.hit_count > 1) {
    return { label: m.name, hitCount: m.hit_count };
  }
  const match = m.name.match(/^(.+?)\s*×(\d+)\s*$/);
  if (match) return { label: match[1]!, hitCount: parseInt(match[2]!, 10) };
  return { label: m.name, hitCount: 1 };
}
