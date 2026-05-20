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
      /** FFLogs returns this as a JSON scalar — the shape is either
       *  `{ data: { playerDetails: { tanks, healers, dps } } }` or
       *  the unwrapped variant. We handle both at parse time. */
      playerDetails: unknown;
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
  time: number;           // seconds since fight start (first event's time, for display)
  targetNames: string[];  // unique player names hit
  damage_kind: 'physical' | 'magical' | 'pure';
  sample_amount: number;  // for debugging — total damage in the group
  /** xivapi action id (= FFLogs abilityGameID). Used post-aggregation to
   *  look up the real AttackType, which gives us a reliable damage_kind. */
  game_id?: number;
  /** Display name of the NPC that cast this mech. Lets the frontend
   *  spawn one boss lane per concurrent enemy (Shinryu + Wings, M3S
   *  Brute body + adds, …). */
  source_name?: string;
  /** Number of damage events merged into this group. Helps the user
   *  see "ELECTROCUTION ×3" vs "ELECTROCUTION ×1" without us having to
   *  show every hit separately on the timeline. */
  hit_count: number;
  /** Timestamp (ms, absolute) of the LATEST event merged into this
   *  group. Used as the sliding-window anchor : the next event for
   *  this ability name merges only if it arrives within GROUP_WINDOW_MS
   *  of this value (not of the first event's time). Stripped from the
   *  response. */
  _lastEventTime: number;
}

const FIGHT_HEADER_QUERY = `
  query FightHeader($code: String!, $fightId: Int!) {
    reportData {
      report(code: $code) {
        fights { id name startTime endTime }
        masterData {
          actors { id name type subType }
          abilities { gameID name type icon }
        }
        playerDetails(fightIDs: [$fightId])
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

/**
 * Friendly cast events — used to recover the cooldowns players actually
 * pressed during the pull. Combined with the seed's `action_id` per
 * ability and the imported player roster, the frontend rebuilds the
 * uses[] array verbatim.
 */
const CASTS_QUERY = `
  query Casts($code: String!, $fightId: Int!, $start: Float, $end: Float) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId]
          dataType: Casts
          startTime: $start
          endTime: $end
          hostilityType: Friendlies
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

interface CastEvent {
  timestamp: number;
  type: string;        // "cast" | "begincast"
  sourceID: number;
  abilityGameID?: number;
  ability?: { name: string; guid: number };
}

/** Multi-hit boss abilities (Akh Morn = 5 hits over ~5s, Earthen Fury
 *  multi-tick raidwide, Tidal Wave double-cast) collapse into a single
 *  mech if the same name fires again within this window. 6s catches
 *  the longest known multi-hit patterns while keeping genuinely
 *  separate casts at >6s apart distinct. */
const GROUP_WINDOW_MS = 6000;

/**
 * xivapi AttackType.ID → our damage_kind enum.
 *
 * Codes match the FFXIV "Attack Type" table :
 *   1 = slashing   2 = piercing   3 = blunt   4 = shot   (all physical)
 *   5 = magic      6 = breath    7 = sound                (magical-ish)
 *   8 = limit-break (unmitigable → treat as pure)
 *   null = ability doesn't have a damage type (buff/trigger) — default
 *          to magical since named raid mechs that DO damage without a
 *          type set are usually scripted magical AoEs.
 */
function attackTypeIdToDamageKind(id: number | null | undefined): 'physical' | 'magical' | 'pure' {
  if (id === 1 || id === 2 || id === 3 || id === 4) return 'physical';
  if (id === 5 || id === 6 || id === 7) return 'magical';
  if (id === 8) return 'pure';
  return 'magical';
}

/** Batch-fetch xivapi AttackType.ID for a set of action gameIDs. Fails
 *  silently per-id (network errors map to undefined → magical default). */
async function fetchAttackTypes(gameIds: number[]): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  await Promise.all(
    gameIds.map(async (id) => {
      try {
        const res = await fetch(`https://xivapi.com/action/${id}?columns=AttackType.ID`);
        if (!res.ok) return;
        const j = (await res.json()) as { AttackType?: { ID: number | null } };
        out.set(id, j.AttackType?.ID ?? null);
      } catch {
        /* ignore — leaves the id unset, default kicks in */
      }
    }),
  );
  return out;
}

export const onRequestPost: PagesFunction<FFLogsEnv> = async (ctx) => {
  const body = (await ctx.request.json().catch(() => ({}))) as ReqBody;
  if (!body.code || typeof body.fightId !== 'number') {
    return jsonResp({ error: 'Expected { code: string, fightId: number }' }, 400);
  }

  try {
    // 1. Fight header (start/end + actor catalog + per-fight roster)
    const header = await fflogsQuery<FightHeaderResp>(ctx.env, FIGHT_HEADER_QUERY, {
      code: body.code,
      fightId: body.fightId,
    });
    const fight = header.reportData.report.fights.find((f) => f.id === body.fightId);
    if (!fight) return jsonResp({ error: 'Fight not in report' }, 404);
    const actors = new Map(header.reportData.report.masterData.actors.map((a) => [a.id, a]));
    const abilities = new Map(
      (header.reportData.report.masterData.abilities ?? []).map((a) => [a.gameID, a]),
    );

    // Build the player roster from playerDetails (per-fight, ~8
    // players) rather than masterData.actors (whole report,
    // potentially 50+ across all pulls). Falls back to the actors
    // filter if FFLogs returned an unexpected shape.
    type PdPlayer = { name?: string; type?: string };
    type PdShape = { tanks?: PdPlayer[]; healers?: PdPlayer[]; dps?: PdPlayer[] };
    const rawPd = header.reportData.report.playerDetails as unknown;
    let pdRoot: PdShape | null = null;
    if (rawPd && typeof rawPd === 'object') {
      // Two known shapes — try the wrapped one first.
      const wrapped = (rawPd as { data?: { playerDetails?: PdShape } }).data?.playerDetails;
      pdRoot = wrapped ?? (rawPd as PdShape);
    }
    const pdPlayers = [
      ...(pdRoot?.tanks ?? []),
      ...(pdRoot?.healers ?? []),
      ...(pdRoot?.dps ?? []),
    ]
      .filter((p) => p.name && p.type)
      .map((p) => ({ name: p.name!, subType: p.type! }));

    const players =
      pdPlayers.length > 0
        ? pdPlayers
        : header.reportData.report.masterData.actors
            .filter((a) => a.type === 'Player')
            .map((a) => ({ name: a.name, subType: a.subType }));

    /** name → { eventCount, isBoss } for every NPC that did a tracked
     *  damage event. Used to decide which sources deserve their own
     *  boss lane (vs being dumped into a catch-all "Adds" lane). */
    const sourceStats = new Map<string, { eventCount: number; isBoss: boolean }>();

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
      // Explicit annotation : cursor is updated below from evResp.…, which
      // creates an indirect self-reference TS can't unwind otherwise.
      const evResp: EventsResp = await fflogsQuery<EventsResp>(ctx.env, EVENTS_QUERY, {
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
        // Track source NPC for lane assignment later.
        const sourceActor = actors.get(ev.sourceID);
        const sourceName = sourceActor?.name || 'Unknown';
        const stats = sourceStats.get(sourceName);
        if (stats) stats.eventCount++;
        else sourceStats.set(sourceName, { eventCount: 1, isBoss: sourceActor?.subType === 'Boss' });
        const relSec = Math.round((ev.timestamp - fight.startTime) / 100) / 10;
        // True sliding-window merge : the next event for this ability
        // joins the existing group as long as it's within GROUP_WINDOW_MS
        // of the GROUP'S LATEST event (not its first). So a continuous
        // stream of DoT ticks or multi-hit beats — even if it stretches
        // over 30s — stays one mech, while a real gap > window splits.
        const lastIdx = lastGroupIdxByName.get(name);
        let idx: number;
        if (
          lastIdx !== undefined &&
          ev.timestamp - groups[lastIdx]!._lastEventTime < GROUP_WINDOW_MS
        ) {
          idx = lastIdx;
        } else {
          idx = groups.length;
          groups.push({
            name,
            time: Math.max(0, relSec),
            targetNames: [],
            damage_kind: 'magical', // refined below via xivapi lookup
            sample_amount: 0,
            game_id: ev.abilityGameID,
            source_name: sourceName,
            hit_count: 0,
            _lastEventTime: ev.timestamp,
          });
          lastGroupIdxByName.set(name, idx);
        }
        // Track abilityType for debug only — discarded below in favour of xivapi.
        void abilityType;
        const g = groups[idx]!;
        g.sample_amount += ev.amount ?? 0;
        g.hit_count++;
        g._lastEventTime = ev.timestamp;
        if (!g.targetNames.includes(targetActor.name)) g.targetNames.push(targetActor.name);
      }
      cursor = evResp.reportData.report.events.nextPageTimestamp;
      if (cursor !== null && cursor <= fight.startTime) break;
      if (cursor !== null && cursor >= fight.endTime) break;
    }

    groups.sort((a, b) => a.time - b.time);

    // 2b. Paginate friendly cast events — to recover the cooldowns each
    // player pressed during the fight. We keep ALL casts (it's typically
    // a few thousand events on a 10-min pull, gzip handles it) and let
    // the frontend filter via the action_id ↔ ability map in the seed.
    const playerUses: { playerName: string; actionId: number; time: number }[] = [];
    let castCursor: number | null = fight.startTime;
    let castPages = 0;
    while (castCursor !== null && castPages < 20) {
      castPages++;
      // See evResp above — same circular-inference workaround.
      const cResp: EventsResp = await fflogsQuery<EventsResp>(ctx.env, CASTS_QUERY, {
        code: body.code,
        fightId: body.fightId,
        start: castCursor,
        end: fight.endTime,
      });
      const cRaw = cResp.reportData.report.events.data;
      const castEvents: CastEvent[] = Array.isArray(cRaw)
        ? (cRaw as CastEvent[])
        : typeof cRaw === 'string'
          ? (JSON.parse(cRaw) as CastEvent[])
          : [];
      for (const ev of castEvents) {
        // Only confirmed casts — drop "begincast" (a long cast that
        // might get cancelled — we'd otherwise double-count it).
        if (ev.type !== 'cast') continue;
        if (ev.abilityGameID == null) continue;
        const src = actors.get(ev.sourceID);
        if (!src || src.type !== 'Player') continue;
        playerUses.push({
          playerName: src.name,
          actionId: ev.abilityGameID,
          time: Math.max(0, Math.round((ev.timestamp - fight.startTime) / 100) / 10),
        });
      }
      castCursor = cResp.reportData.report.events.nextPageTimestamp;
      if (castCursor !== null && castCursor <= fight.startTime) break;
      if (castCursor !== null && castCursor >= fight.endTime) break;
    }

    // Resolve damage_kind via xivapi AttackType for each unique gameID.
    // FFLogs' own ability.type is a bitfield about behaviour (auto, AoE,
    // DoT, ...), not damage school — so we go to the source of truth.
    const uniqueIds = Array.from(new Set(groups.map((g) => g.game_id).filter((v): v is number => v != null)));
    if (uniqueIds.length > 0) {
      const typeMap = await fetchAttackTypes(uniqueIds);
      for (const g of groups) {
        if (g.game_id != null) {
          g.damage_kind = attackTypeIdToDamageKind(typeMap.get(g.game_id));
        }
      }
    }

    // Decide which sources deserve a dedicated boss lane :
    //   - explicit Boss subType  → always
    //   - other NPCs with >= MIN_EVENTS damage events on players → yes
    //   - smaller adds (1-2 hits) get merged under "Adds"
    const MIN_EVENTS = 5;
    const bossNames: string[] = [];
    const addsName = 'Adds';
    let hasAdds = false;
    for (const [name, st] of sourceStats) {
      if (st.isBoss || st.eventCount >= MIN_EVENTS) bossNames.push(name);
      else hasAdds = true;
    }
    // Sort : Boss subtype first, then by event count desc, stable by name.
    bossNames.sort((a, b) => {
      const sa = sourceStats.get(a)!;
      const sb = sourceStats.get(b)!;
      if (sa.isBoss !== sb.isBoss) return sa.isBoss ? -1 : 1;
      return sb.eventCount - sa.eventCount;
    });
    const lanes = [...bossNames];
    if (hasAdds) lanes.push(addsName);

    // Rewrite source_name on groups so any mech from a "minor" NPC
    // lands in the "Adds" bucket and doesn't trail a phantom lane.
    // Also strip the internal _lastEventTime field — it's only useful
    // server-side during aggregation, the client doesn't need it.
    for (const g of groups) {
      if (g.source_name && !bossNames.includes(g.source_name)) g.source_name = addsName;
      delete (g as Partial<AggregatedMech>)._lastEventTime;
    }

    return jsonResp({
      fightName: fight.name,
      fightStart: fight.startTime,
      fightEnd: fight.endTime,
      fightDuration: Math.round((fight.endTime - fight.startTime) / 1000),
      bossLanes: lanes,
      players,
      mechanics: groups,
      playerUses,
      _debug: {
        castPages,
        castEventsKept: playerUses.length,
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
        sourceStats: Object.fromEntries(sourceStats),
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
