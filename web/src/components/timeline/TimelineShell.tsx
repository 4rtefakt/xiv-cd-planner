import { usePlanStore } from '../../state/planStore';
import { TimelineAxis } from './TimelineAxis';
import { BossLanesLeft, BossLanesRight } from './BossLanes';
import { PlayerGroupsLeft, PlayerGroupsRight } from './PlayerGroups';

/**
 * Section 02 main grid. C.1 ships:
 *   - Toolbar (buttons still wireless — they'll get handlers in C.2/C.4)
 *   - 2-col grid: 230px labels + scrollable canvas (min 1600px)
 *   - Axis row with major/minor ticks
 *   - BOSS A lane (single by default; user can add more)
 *   - Empty space below boss lanes (player groups land in C.4)
 *   - Static legend
 *
 * Mechanics, drag/drop, cd-use rendering, coverage% — all later phases.
 */
export function TimelineShell() {
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const addBossLane = usePlanStore((s) => s.addBossLane);
  const resetEncounter = usePlanStore((s) => s.resetEncounter);
  const openModal = usePlanStore((s) => s.openMechanicModal);
  const firstLaneId = usePlanStore((s) => s.bossLanes[0]?.id ?? 'lane-1');

  const quickAdd = (type: 'raidwide' | 'tankbuster' | 'autos' | 'custom') =>
    openModal(firstLaneId, Math.round(fightDuration / 2), type);

  return (
    <>
      <div className="timeline-toolbar">
        <span className="tl-tool-label">QUICK-ADD MECH</span>
        <button type="button" className="tl-btn raidwide"   onClick={() => quickAdd('raidwide')}>RAIDWIDE</button>
        <button type="button" className="tl-btn tankbuster" onClick={() => quickAdd('tankbuster')}>TANKBUSTER</button>
        <button type="button" className="tl-btn autos"      onClick={() => quickAdd('autos')}>AUTOS</button>
        <button type="button" className="tl-btn custom"     onClick={() => quickAdd('custom')}>CUSTOM</button>
        <div className="tl-divider" />
        <span className="tl-tool-label">LANES</span>
        <button type="button" className="tl-btn add-lane" onClick={addBossLane}>
          ADD BOSS LANE
        </button>
        <button
          type="button"
          className="tl-btn reset no-plus"
          onClick={() => {
            if (window.confirm('Reset all mechanics and assignments?')) resetEncounter();
          }}
        >
          ◆ RESET
        </button>
      </div>

      <div className="timeline-shell">
        <div className="tl-left">
          <div className="tl-axis-spacer">
            PLAYER <span className="sep" style={{ color: 'var(--text-faint)', margin: '0 6px' }}>/</span> ABILITY
          </div>
          <BossLanesLeft />
          <PlayerGroupsLeft />
        </div>
        <div className="tl-right">
          <div className="tl-canvas">
            <TimelineAxis fightDuration={fightDuration} />
            <BossLanesRight />
            <PlayerGroupsRight />
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--raidwide)' } as React.CSSProperties} />RAIDWIDE</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--tankbuster)' } as React.CSSProperties} />TANKBUSTER</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--autos)' } as React.CSSProperties} />AUTOS</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--custom)' } as React.CSSProperties} />CUSTOM</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--cyan)' } as React.CSSProperties} />PERSONAL</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--pink)' } as React.CSSProperties} />PARTY</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--heal)' } as React.CSSProperties} />HEAL</div>
      </div>
    </>
  );
}
