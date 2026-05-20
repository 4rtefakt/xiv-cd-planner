/**
 * Global middleware for all Pages Functions under /api/*.
 *
 * - Adds CORS headers (whitelist: localhost dev + prod domain)
 * - Replies to OPTIONS preflight directly
 * - Catches uncaught errors and returns a JSON 500 instead of leaking stack
 */

import type { Env } from './_types';

const ALLOWED_ORIGINS = new Set([
  'http://localhost:8788',
  'http://localhost:5173',
  'http://127.0.0.1:8788',
  'http://127.0.0.1:5173',
  'https://cooldown-planner.pages.dev',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://cooldown-planner.pages.dev';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const origin = ctx.request.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const res = await ctx.next();
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[_middleware]', message);
    return new Response(JSON.stringify({ error: 'internal_error', message }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
};
