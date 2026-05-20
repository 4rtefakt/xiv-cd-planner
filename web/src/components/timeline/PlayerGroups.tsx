import { useMemo } from 'react';
import type { Job } from '../../types';
import { AbilityIcon, JobIcon } from '../Icon';
import { usePlanStore } from '../../state/planStore';
import { AbilityRow } from './AbilityRow';

/**
 * Left labels column for the player groups. Each player has:
 *   - a header row (job icon + name + badge + collapse caret)
 *   - one ability row per ability of the player's job (when expanded)
 *
 * Click on header → toggle collapse.
 */
export function PlayerGroupsLeft() {
  const party = usePlanStore((s) => s.party);
  const jobs = usePlanStore((s) => s.jobs);
  const collapsed = usePlanStore((s) => s.collapsed);
  const toggleCollapsed = usePlanStore((s) => s.toggleCollapsed);

  const jobByCode = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.code, j);
    return m;
  }, [jobs]);

  let alt = 0;

  return (
    <div className="left-player-groups">
      {party.map((p) => {
        const job = jobByCode.get(p.job);
        const sortedAbilities = job ? [...job.abilities].sort((a, b) => b.recast - a.recast) : [];
        const isCollapsed = !!collapsed[p.id];
        const role = job?.role ?? 'dps';
        return (
          <div key={p.id} className="player-group">
            <div
              className={`player-header-left player-header-row-height role-${role}`}
              onClick={() => toggleCollapsed(p.id)}
            >
              <div className="ph-job-icon">
                {job ? <JobIcon src={job.icon} fallbackCode={job.code} alt={job.name} /> : null}
              </div>
              <div className="ph-name-block">
                <span className="ph-name">{p.name}</span>
                <span className="ph-badge">{p.badge}</span>
              </div>
              <span className="ph-collapse">{isCollapsed ? '▶' : '▼'}</span>
            </div>
            {!isCollapsed &&
              sortedAbilities.map((ab) => {
                const altClass = alt++ % 2 === 1 ? 'alt' : '';
                return (
                  <div key={ab.id} className={`cd-row-left type-${ab.mit_type} cd-row-height ${altClass}`}>
                    <span className="cd-indent" />
                    <span className="cd-ability-icon" style={{ color: 'var(--ability-color)' }}>
                      <AbilityIcon src={ab.icon} fallbackGlyph={ab.icon_glyph} alt={ab.name} />
                    </span>
                    <span className="cd-row-name">{ab.name}</span>
                    <span className="cd-row-cd">{ab.recast}s</span>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Right canvas column — header strip per player (role-tinted) + drop-
 * target ability rows. Counts alternating-row stripes from the same
 * counter as the left side so the visual zebra stays aligned.
 */
export function PlayerGroupsRight() {
  const party = usePlanStore((s) => s.party);
  const jobs = usePlanStore((s) => s.jobs);
  const collapsed = usePlanStore((s) => s.collapsed);
  const uses = usePlanStore((s) => s.uses);
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);

  const jobByCode = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.code, j);
    return m;
  }, [jobs]);

  let alt = 0;

  return (
    <div className="right-player-groups">
      {party.map((p) => {
        const job = jobByCode.get(p.job);
        const sortedAbilities = job ? [...job.abilities].sort((a, b) => b.recast - a.recast) : [];
        const isCollapsed = !!collapsed[p.id];
        const role = job?.role ?? 'dps';
        return (
          <div key={p.id} className="player-group">
            <div className={`player-header-right player-header-row-height role-${role}`} />
            {!isCollapsed &&
              sortedAbilities.map((ab) => {
                const isAlt = alt++ % 2 === 1;
                return (
                  <AbilityRow
                    key={ab.id}
                    playerId={p.id}
                    ability={ab}
                    uses={uses}
                    alt={isAlt}
                    fightDuration={fightDuration}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

