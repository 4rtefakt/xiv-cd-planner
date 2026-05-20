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
        abilities: { gameID: number; name: string; type: number; icon: string }[];
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
  abilityGameID?: number; // FFLogs v2 inlines this ; resolve via masterData.abilities
  ability?: { name: string; guid: number; type: number }; // some endpoints embed it
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
        masterData {
          actors { id name type subType }
          abilities { gameID name type icon }
        }
      }
    }
  }
`;

const EVENTS_QUERY = `
  query Events($code: String!, $fightId: Int!, $start: Float, $end: Float) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId]
          dataType: DamageDone
          startTime: $start
          endTime: $end
          hostilityType: Enemies
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

/** Multi-hit raidwides ("Earthen Fury" hitting at 20.8/22.9/23.3s
 *  share one cast) collapse into a single mech if the same name fires
 *  again within this window. */
const GROUP_WINDOW_MS = 3500;

/**
 * FFLogs ability.type → our damage_kind enum.
 *
 * The numeric codes come from xivapi's "Attack Type" table :
 *   1 = slashing  2 = piercing  3 = blunt   (all physical)
 *   5 = magical   6 = breath
 *   7 = unique / limit-break (unmitigable → treat as pure)
 *   etc.
 *
 * Default to magical for unknowns since the vast majority of raid
 * damage spells are magical.
 */
function deriveDamageKind(abilityType: number | undefined): 'physical' | 'magical' | 'pure' {
  if (abilityType === 1 || abilityType === 2 || abilityType === 3) return 'physical';
  if (abilityType === 5 || abilityType === 6) return 'magical';
  if (abilityType === 7 || abilityType === 8) return 'pure';
  return 'magical';
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
    const abilities = new Map(
      (header.reportData.report.masterData.abilities ?? []).map((a) => [a.gameID, a]),
    );

    // 2. Paginate damage events
    const groups: AggregatedMech[] = [];
    /** Index of the most-recent group per ability name. Lets us merge
     *  multi-hit casts into one group when they're close in time, while
     *  still creating new groups when the same ability fires again later
     *  in the fight (e.g. a raidwide repeated every 60s). */
    const lastGroupIdxByName = new Map<string, number>();
    let cursor: number | null = fight.startTime;
    let pages = 0;
    // Debug counters — surfaced in the response so we can diagnose
    // empty imports (Shinryu Ex prog produced 0 mechs).
    let rawEventCount = 0;
    let skipNoAbility = 0;
    let skipAutoAttack = 0;
    let skipZeroAmount = 0;
    let skipNonPlayerTarget = 0;
    let sampleTargetTypes = new Set<string>();
    let sampleAbilityNames: string[] = [];

    while (cursor !== null && pages < 20) {
      pages++;
      const evResp = await fflogsQuery<EventsResp>(ctx.env, EVENTS_QUERY, {
        code: body.code,
        fightId: body.fightId,
        start: cursor,
        end: fight.endTime,
      });
      const dataRaw = evResp.reportData.report.events.data;
      const events: DamageEvent[] = Array.isArray(dataRaw)
        ? (dataRaw as DamageEvent[])
        : typeof dataRaw === 'string'
          ? (JSON.parse(dataRaw) as DamageEvent[])
          : [];
      rawEventCount += events.length;
      for (const ev of events) {
        // Resolve ability name : prefer inlined ev.ability (some endpoints
        // give it), fall back to masterData lookup via abilityGameID.
        const inlineName = ev.ability?.name;
        const masterAb = ev.abilityGameID != null ? abilities.get(ev.abilityGameID) : undefined;
        const name = inlineName ?? masterAb?.name;
        const abilityType = ev.ability?.type ?? masterAb?.type;
        if (!name) { skipNoAbility++; continue; }
        if (name.toLowerCase() === 'attack') { skipAutoAttack++; continue; }
        if (!ev.amount || ev.amount === 0) { skipZeroAmount++; continue; }
        const targetActor = actors.get(ev.targetID);
        if (targetActor) sampleTargetTypes.add(targetActor.type);
        if (!targetActor || targetActor.type !== 'Player') { skipNonPlayerTarget++; continue; }

        if (sampleAbilityNames.length < 5) sampleAbilityNames.push(name);
        const relSec = Math.round((ev.timestamp - fight.startTime) / 100) / 10;
        // Sliding window : if there's already a group for this ability
        // within GROUP_WINDOW_MS of THIS event, merge. Otherwise start
        // a new group. Events arrive in timestamp order from FFLogs.
        const lastIdx = lastGroupIdxByName.get(name);
        let idx: number;
        if (
          lastIdx !== undefined &&
          ev.timestamp - (groups[lastIdx]!.time * 1000 + fight.startTime) < GROUP_WINDOW_MS
        ) {
          idx = lastIdx;
        } else {
          idx = groups.length;
          groups.push({
            name,
            time: Math.max(0, relSec),
            targetNames: [],
            damage_kind: deriveDamageKind(abilityType),
            sample_amount: 0,
          });
          lastGroupIdxByName.set(name, idx);
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
      _debug: {
        pages,
        rawEventCount,
        skipNoAbility,
        skipAutoAttack,
        skipZeroAmount,
        skipNonPlayerTarget,
        targetTypesSeen: Array.from(sampleTargetTypes),
        sampleAbilityNames,
        actorsTotal: header.reportData.report.masterData.actors.length,
        actorTypes: Array.from(new Set(header.reportData.report.masterData.actors.map((a) => a.type))),
      },
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
