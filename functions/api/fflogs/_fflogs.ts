/**
 * Shared FFLogs v2 GraphQL helpers used by the two endpoints below.
 *
 * Auth uses a single account-level Personal Access Token stored in the
 * Cloudflare secret FFLOGS_API_TOKEN. The token is sent as a Bearer
 * header on every call. The free FFLogs tier allows ~500 points/hour
 * which is plenty for a planner that fetches one report per import.
 *
 * Setup once :
 *   1. Create a PAT at https://www.fflogs.com/api/clients/ (Client section
 *      → Generate). The "v2 API" page shows a "Personal Access Token"
 *      button that takes 2 clicks.
 *   2. `wrangler pages secret put FFLOGS_API_TOKEN`
 *      (paste the token at the prompt). Same for preview env if you use one.
 */

const ENDPOINT = 'https://www.fflogs.com/api/v2/client';

export interface FFLogsEnv {
  FFLOGS_API_TOKEN?: string;
}

export class FFLogsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Run a GraphQL query against the FFLogs v2 client API. Throws
 * FFLogsError with an HTTP status on failure so the calling Function
 * can return a structured error to the frontend.
 */
export async function fflogsQuery<T>(env: FFLogsEnv, query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!env.FFLOGS_API_TOKEN) {
    throw new FFLogsError(
      'FFLOGS_API_TOKEN is not configured. Run `wrangler pages secret put FFLOGS_API_TOKEN` (paste a PAT from https://www.fflogs.com/api/clients/).',
      503,
    );
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.FFLOGS_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) {
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
