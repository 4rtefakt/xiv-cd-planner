import { useMemo } from 'react';
import type { Ability, Job } from '../../types';
import { AbilityIcon, JobIcon } from '../Icon';
import { usePlanStore } from '../../state/planStore';
import { abilityName, jobName } from '../../i18n';
import { resolveAbilityAtLevel } from '../../lib/abilityResolve';
import { AbilityRow } from './AbilityRow';
import { AbilityTooltipHost } from '../AbilityTooltip';

/**
 * Filter + sort an ability list for display :
 *   - drop abilities not unlocked at the encounter's level
 *   - drop abilities the user has manually hidden for this room
 *   - resolve level_variants → returned objects already carry the
 *     scaled potency/recast/effect for `level`
 *   - sort by recast desc (long CDs at the top, instants at the bottom)
 *
 * Hidden abilities stay in the seed (their uses can be restored if the
 * user un-hides them later in the same plan), but disappear from the UI.
 */
function filterAndSortAbilities(
  job: Job | undefined,
  level: number,
  hiddenIds: string[],
): Ability[] {
  if (!job) return [];
  const hiddenSet = new Set(hiddenIds);
  return job.abilities
    .filter((ab) => ab.level_unlocked <= level && !hiddenSet.has(ab.id))
    .map((ab) => resolveAbilityAtLevel(ab, level))
    .sort((a, b) => b.recast - a.recast);
}

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
  const lang = usePlanStore((s) => s.lang);
  const level = usePlanStore((s) => s.encounter.level);
  const hiddenAbilityIds = usePlanStore((s) => s.hiddenAbilityIds);
  const toggleAbilityHidden = usePlanStore((s) => s.toggleAbilityHidden);
  const readOnly = usePlanStore((s) => s.readOnly);

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
        const sortedAbilities = filterAndSortAbilities(job, level, hiddenAbilityIds);
        // Abilities the user hid for this room AND that this job actually
        // has (so a hidden BRD ability doesn't surface as "hidden" on PLD).
        // Resolved at the encounter level so the chip shows the right
        // form (name + icon) — Sheltron, not Holy Sheltron, at lvl 70.
        const hiddenForThisJob = job
          ? job.abilities
              .filter((ab) => hiddenAbilityIds.includes(ab.id) && ab.level_unlocked <= level)
              .map((ab) => resolveAbilityAtLevel(ab, level))
          : [];
        const isCollapsed = !!collapsed[p.id];
        const role = job?.role ?? 'dps';
        return (
          <div key={p.id} className="player-group">
            <div
              className={`player-header-left player-header-row-height role-${role}${role === 'dps' && job?.sub_role ? ` sub-${job.sub_role}` : ''}`}
              onClick={() => toggleCollapsed(p.id)}
            >
              <div className="ph-job-icon">
                {job ? <JobIcon src={job.icon} fallbackCode={job.code} alt={jobName(job, lang)} /> : null}
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
                  <AbilityTooltipHost key={ab.id} ability={ab}>
                    <div
                      className={`cd-row-left type-${ab.mit_type} cd-row-height ${altClass}`}
                      onContextMenu={(e) => {
                        if (readOnly) return;
                        e.preventDefault();
                        toggleAbilityHidden(ab.id);
                      }}
                    >
                      <span className="cd-indent" />
                      <span className="cd-ability-icon" style={{ color: 'var(--ability-color)' }}>
                        <AbilityIcon src={ab.icon} fallbackGlyph={ab.icon_glyph} alt={abilityName(ab, lang)} />
                      </span>
                      <span className="cd-row-name">{abilityName(ab, lang)}</span>
                      <span className="cd-row-cd">{ab.recast}s</span>
                    </div>
                  </AbilityTooltipHost>
                );
              })}
            {!isCollapsed && hiddenForThisJob.length > 0 && (
              <div className="cd-row-hidden-footer">
                <span className="cd-indent" />
                {hiddenForThisJob.map((ab) => (
                  <button
                    key={ab.id}
                    type="button"
                    className="cd-hidden-chip"
                    onClick={() => toggleAbilityHidden(ab.id)}
                    title={abilityName(ab, lang)}
                  >
                    <span className="cd-hidden-chip-icon">
                      <AbilityIcon src={ab.icon} fallbackGlyph={ab.icon_glyph} alt={abilityName(ab, lang)} />
                    </span>
                    <span className="cd-hidden-chip-name">{abilityName(ab, lang)}</span>
                    <span className="cd-hidden-chip-x">+</span>
                  </button>
                ))}
              </div>
            )}
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
  const level = usePlanStore((s) => s.encounter.level);
  const hiddenAbilityIds = usePlanStore((s) => s.hiddenAbilityIds);

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
        const sortedAbilities = filterAndSortAbilities(job, level, hiddenAbilityIds);
        const hiddenForThisJob = job
          ? job.abilities.filter(
              (ab) => hiddenAbilityIds.includes(ab.id) && ab.level_unlocked <= level,
            )
          : [];
        const isCollapsed = !!collapsed[p.id];
        const role = job?.role ?? 'dps';
        return (
          <div key={p.id} className="player-group">
            <div className={`player-header-right player-header-row-height role-${role}${role === 'dps' && job?.sub_role ? ` sub-${job.sub_role}` : ''}`} />
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
            {/* Empty spacer matching the .cd-row-hidden-footer on the left
                column so the two scroll regions stay vertically aligned. */}
            {!isCollapsed && hiddenForThisJob.length > 0 && (
              <div className="cd-row-hidden-footer-spacer" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

