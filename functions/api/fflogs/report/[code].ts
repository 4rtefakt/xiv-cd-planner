/**
 * GET /api/fflogs/report/:code
 *
 * Returns a trimmed view of an FFLogs report : its title, owner,
 * and the list of fights (id, name, kill, duration, encounterID).
 *
 * The frontend then lets the user pick a fight, which goes through
 * /api/fflogs/fight to harvest the actual mechanics.
 */

import { FFLogsError, fflogsQuery, parseReportRef, type FFLogsEnv } from '../_fflogs';

type Env = FFLogsEnv;

interface FightRow {
  id: number;
  name: string;
  encounterID: number;
  startTime: number;
  endTime: number;
  kill: boolean | null;
  difficulty: number | null;
  fightPercentage: number | null;
}

interface ReportResponse {
  reportData: {
    report: {
      title: string;
      owner: { name: string } | null;
      startTime: number;
      endTime: number;
      fights: FightRow[];
    } | null;
  };
}

const QUERY = `
  query Report($code: String!) {
    reportData {
      report(code: $code) {
        title
        owner { name }
        startTime
        endTime
        fights(killType: Encounters) {
          id
          name
          encounterID
          startTime
          endTime
          kill
          difficulty
          fightPercentage
        }
      }
    }
  }
`;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const raw = ctx.params.code as string;
  const ref = parseReportRef(raw);
  if (!ref) {
    return new Response(JSON.stringify({ error: 'Invalid report code' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const data = await fflogsQuery<ReportResponse>(ctx.env, QUERY, { code: ref.code });
    if (!data.reportData.report) {
      return new Response(JSON.stringify({ error: 'Report not found or private' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    const r = data.reportData.report;
    return new Response(
      JSON.stringify({
        code: ref.code,
        title: r.title,
        owner: r.owner?.name ?? null,
        startTime: r.startTime,
        endTime: r.endTime,
        fights: r.fights.map((f) => ({
          id: f.id,
          name: f.name,
          encounterID: f.encounterID,
          startTime: f.startTime,
          endTime: f.endTime,
          duration: f.endTime - f.startTime,
          kill: f.kill ?? false,
          difficulty: f.difficulty ?? null,
          fightPercentage: f.fightPercentage ?? null,
        })),
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof FFLogsError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
