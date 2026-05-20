/**
 * Shared FFLogs v2 GraphQL helpers used by the two endpoints below.
 *
 * Auth uses the OAuth2 client-credentials flow :
 *   - FFLOGS_CLIENT_ID + FFLOGS_CLIENT_SECRET stored as Cloudflare secrets
 *   - POST to /oauth/token → access_token (expires in 1h)
 *   - Bearer that access_token on subsequent GraphQL calls
 *   - Cache the access_token in a module-level variable so the OAuth
 *     dance only happens once per Worker isolate cold start
 *
 * Setup once :
 *   1. Register at https://www.fflogs.com/api/clients/ — keep "Public
 *      Client" UNCHECKED (we have a secure backend, the secret is safe
 *      in Cloudflare's secrets store).
 *   2. Redirect URLs can be left empty (only used for the auth-code
 *      flow, not for client-credentials).
 *   3. After Create you get a Client ID + Client Secret. Set both :
 *        wrangler pages secret put FFLOGS_CLIENT_ID --project-name=cooldown-planner
 *        wrangler pages secret put FFLOGS_CLIENT_SECRET --project-name=cooldown-planner
 */

const TOKEN_ENDPOINT = 'https://www.fflogs.com/oauth/token';
const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';

export interface FFLogsEnv {
  FFLOGS_CLIENT_ID?: string;
  FFLOGS_CLIENT_SECRET?: string;
}

export class FFLogsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let cachedToken: TokenCache | null = null;

/**
 * Get a valid access token, exchanging client credentials if the cache
 * is empty or within 60s of expiry. Refreshes are O(1) per hour.
 */
async function getAccessToken(env: FFLogsEnv): Promise<string> {
  if (!env.FFLOGS_CLIENT_ID || !env.FFLOGS_CLIENT_SECRET) {
    throw new FFLogsError(
      'FFLOGS_CLIENT_ID / FFLOGS_CLIENT_SECRET are not configured. See README → "Activer l\'import FFLogs".',
      503,
    );
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  const credentials = btoa(`${env.FFLOGS_CLIENT_ID}:${env.FFLOGS_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FFLogsError(`FFLogs OAuth ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

/**
 * Run a GraphQL query against the FFLogs v2 client API. Throws
 * FFLogsError with an HTTP status on failure so the calling Function
 * can return a structured error to the frontend.
 */
export async function fflogsQuery<T>(env: FFLogsEnv, query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken(env);
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) {
    // If the token went stale mid-call, drop it so the next call re-fetches.
    if (res.status === 401) cachedToken = null;
    const body = await res.text().catch(() => '');
    throw new FFLogsError(`FFLogs HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new FFLogsError(json.errors.map((e) => e.message).join(' ; '), 502);
  }
  if (!json.data) throw new FFLogsError('FFLogs returned no data', 502);
  return json.data;
}

/**
 * Extract a report code (and optional fight id) from a pasted URL or
 * raw code. Accepts :
 *   - "abcDEF123"                                       (raw code)
 *   - "https://www.fflogs.com/reports/abcDEF123"
 *   - "https://www.fflogs.com/reports/abcDEF123#fight=12"
 *   - any subdomain (a.fflogs.com, www.fflogs.com, fr.fflogs.com)
 */
export function parseReportRef(input: string): { code: string; fightId?: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare code is 16-20 alphanumeric chars.
  if (/^[a-zA-Z0-9]{12,24}$/.test(trimmed)) return { code: trimmed };
  // URL form
  const urlMatch = trimmed.match(/\/reports\/([a-zA-Z0-9]+)(?:[/?#].*)?$/);
  if (!urlMatch) return null;
  const code = urlMatch[1]!;
  const fightMatch = trimmed.match(/[#&?]fight=(\d+)/);
  return fightMatch ? { code, fightId: Number(fightMatch[1]) } : { code };
}
