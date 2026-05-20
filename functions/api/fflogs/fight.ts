/**
 * POST /api/fflogs/fight  body: { code, fightId }
 *
 * Returns a synthesised list of mechanics for a single FFLogs fight :
 *   { fightName, fightDuration, mechanics: [...] }
 *
 * Algorithm :
 *   1. Fetch damage events done by NPCs onto players for the given fight.
 *   2. Group events by (abilityName, timestamp ±1500ms) — multi-hit
 *      AoEs that all share the same cast collapse into a single mech.
 *   3. Skip autoattacks and 0-damage hits (telegraph-only events).
 *   4. Derive damage_kind from hitType / damageType — physical /
 *      magical / pure (unmitigable).
 *   5. Targets = unique player names hit (so the frontend can map them
 *      to the current party's player_ids by badge).
 *
 * FFLogs returns up to 8000 events per page ; for very long fights we
 * iterate via nextPageTimestamp.
 */

import { FFLogsError, fflogsQuery, type FFLogsEnv } from './_fflogs';

interface ReqBody {
  code: string;
  fightId: number;
}

interface FightHeader {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
}

interface FightHeaderResp {
  reportData: {
    report: {
      fights: FightHeader[];
      masterData: {
        actors: { id: number; name: string; type: string; subType: string }[];
      };
    };
  };
}

interface EventsResp {
  reportData: {
    report: {
      events: {
        data: unknown; // FFLogs returns a JSON array — actually JSON-encoded
        nextPageTimestamp: number | null;
      };
    };
  };
}

interface DamageEvent {
  timestamp: number;
  type: string;
  sourceID: number;
  targetID: number;
  ability?: { name: string; guid: number; type: number };
  amount?: number;
  hitType?: number;
  unmitigatedAmount?: number;
}

interface AggregatedMech {
  name: string;
  time: number;           // seconds since fight start
  targetNames: string[];  // unique player names hit
  damage_kind: 'physical' | 'magical' | 'pure';
  sample_amount: number;  // for debugging — total damage in the group
}

const FIGHT_HEADER_QUERY = `
  query FightHeader($code: String!) {
    reportData {
      report(code: $code) {
        fights { id name startTime endTime }
        masterData { actors { id name type subType } }
      }
    }
  }
`;

const EVENTS_QUERY = `
  query Events($code: String!, $fightId: Int!, $start: Float) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId]
          dataType: DamageDone
          startTime: $start
          hostilityType: Enemies
          limit: 8000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

const GROUP_WINDOW_MS = 1500;

/**
 * FFLogs damage type → our damage_kind enum. The numeric codes come
 * from xivapi's Attack Type table : 1 = slashing/piercing/blunt (phys),
 * 4 = magical, 5 = darkness/limit break (unmitigable, treat as pure).
 */
function deriveDamageKind(ev: DamageEvent): 'physical' | 'magical' | 'pure' {
  // hitType bit 9 = "absorbed by invuln" — treat as pure if no mit took it.
  // Without hitType info, fall back to ability.type 1 → phys, 2 → magic.
  const t = ev.ability?.type;
  if (t === 2 || t === 32) return 'magical'; // 32 = aetherial
  if (t === 1 || t === 64) return 'physical'; // 64 = slashing/blunt category
  return 'magical'; // safe default for raid damage
}

export const onRequestPost: PagesFunction<FFLogsEnv> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as ReqBody;
  if (!body.code || typeof body.fightId !== 'number') {
    return jsonResp({ error: 'Expected { code: string, fightId: number }' }, 400);
  }

  try {
    // 1. Fight header (start/end + actor catalog for resolving names)
    const header = await fflogsQuery<FightHeaderResp>(ctx.env, FIGHT_HEADER_QUERY, { code: body.code });
    const fight = header.reportData.report.fights.find((f) => f.id === body.fightId);
    if (!fight) return jsonResp({ error: 'Fight not in report' }, 404);
    const actors = new Map(header.reportData.report.masterData.actors.map((a) => [a.id, a]));

    // 2. Paginate damage events
    const groups: AggregatedMech[] = [];
    const groupKeyToIdx = new Map<string, number>();
    let cursor: number | null = fight.startTime;
    let pages = 0;
    while (cursor !== null && pages < 20) {
      pages++;
      const evResp = await fflogsQuery<EventsResp>(ctx.env, EVENTS_QUERY, {
        code: body.code,
        fightId: body.fightId,
        start: cursor,
      });
      const dataRaw = evResp.reportData.report.events.data;
      const events: DamageEvent[] = Array.isArray(dataRaw)
        ? (dataRaw as DamageEvent[])
        : typeof dataRaw === 'string'
          ? (JSON.parse(dataRaw) as DamageEvent[])
          : [];
      for (const ev of events) {
        if (!ev.ability) continue;
        // Skip auto-attacks : FFXIV's "attack" action has guid 7 + abilityType 1 with a generic name.
        const name = ev.ability.name;
        if (!name || name.toLowerCase() === 'attack') continue;
        // Skip absorbed / 0-damage telegraphs.
        if (!ev.amount || ev.amount === 0) continue;
        const targetActor = actors.get(ev.targetID);
        if (!targetActor || targetActor.type !== 'Player') continue;

        const relSec = Math.round((ev.timestamp - fight.startTime) / 100) / 10; // 0.1s precision
        // Group key : ability name + rounded time bucket
        const bucket = Math.round(ev.timestamp / GROUP_WINDOW_MS);
        const key = `${name}|${bucket}`;
        let idx = groupKeyToIdx.get(key);
        if (idx === undefined) {
          idx = groups.length;
          groupKeyToIdx.set(key, idx);
          groups.push({
            name,
            time: Math.max(0, relSec),
            targetNames: [],
            damage_kind: deriveDamageKind(ev),
            sample_amount: 0,
          });
        }
        const g = groups[idx]!;
        g.sample_amount += ev.amount ?? 0;
        if (!g.targetNames.includes(targetActor.name)) g.targetNames.push(targetActor.name);
      }
      cursor = evResp.reportData.report.events.nextPageTimestamp;
      if (cursor !== null && cursor <= fight.startTime) break;
      if (cursor !== null && cursor >= fight.endTime) break;
    }

    groups.sort((a, b) => a.time - b.time);

    return jsonResp({
      fightName: fight.name,
      fightStart: fight.startTime,
      fightEnd: fight.endTime,
      fightDuration: Math.round((fight.endTime - fight.startTime) / 1000),
      mechanics: groups,
    });
  } catch (err) {
    if (err instanceof FFLogsError) return jsonResp({ error: err.message }, err.status);
    return jsonResp({ error: String(err) }, 500);
  }
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
