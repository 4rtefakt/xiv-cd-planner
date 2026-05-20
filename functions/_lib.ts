/**
 * Small helpers shared by every endpoint. Keep it dependency-free —
 * Pages Functions ship to the edge, every byte counts.
 */

export function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...Object.fromEntries(new Headers(extra)) },
  });
}

export function jsonErr(status: number, error: string, message: string): Response {
  return json({ error, message }, status);
}

/**
 * Generate a URL-safe random slug (default 8 chars, base62).
 * 62^8 ≈ 218 trillion → collision-free at the planner's scale without
 * needing a uniqueness check against existing DOs.
 */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // skip 0/O/I/l/1
export function makeSlug(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHA[buf[i]! % ALPHA.length];
  return out;
}

/**
 * Slug shape guard. Used to reject obviously malformed slug params before
 * spinning up a DO stub for them. We accept the makeSlug alphabet plus
 * `-` and `_` for future-proofing (legacy slugs, manually shared, etc.).
 */
const SLUG_RE = /^[A-Za-z0-9_-]{4,32}$/;
export function isValidSlug(s: string | undefined): s is string {
  return typeof s === 'string' && SLUG_RE.test(s);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
