import { useRef, useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { fmt, pct, xToTime } from '../../lib/time';
import { MechanicMarker } from './Mechanic';

/**
 * Left labels column — one row per boss lane.
 */
export function BossLanesLeft() {
  const bossLanes = usePlanStore((s) => s.bossLanes);
  const removeBossLane = usePlanStore((s) => s.removeBossLane);

  return (
    <div className="left-boss-lanes">
      {bossLanes.map((lane, idx) => (
        <div key={lane.id} className="boss-row-left boss-row-height">
          <span className="lane-num">{String(idx + 1).padStart(2, '0')}</span>
          <span>{lane.name}</span>
          {bossLanes.length > 1 && (
            <span
              className="lane-remove"
              role="button"
              tabIndex={0}
              title="Remove lane"
              onClick={(e) => {
                e.stopPropagation();
                removeBossLane(lane.id);
              }}
            >
              ×
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Right canvas column — one interactive boss row per lane, with:
 *   - hover indicator (vertical dotted line + timestamp following the mouse)
 *   - click anywhere (except on an existing mechanic) → opens AddMechanicModal
 *   - mechanic markers rendered for this lane
 */
export function BossLanesRight() {
  const bossLanes = usePlanStore((s) => s.bossLanes);
  const mechanics = usePlanStore((s) => s.mechanics);
  const uses = usePlanStore((s) => s.uses);
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const openModal = usePlanStore((s) => s.openMechanicModal);

  return (
    <div className="right-boss-lanes">
      {bossLanes.map((lane) => (
        <BossLaneRow
          key={lane.id}
          laneId={lane.id}
          mechanics={mechanics.filter((m) => m.lane_id === lane.id)}
          uses={uses}
          fightDuration={fightDuration}
          onAddAt={(t) => openModal(lane.id, t)}
        />
      ))}
    </div>
  );
}

interface BossLaneRowProps {
  laneId: string;
  mechanics: ReturnType<typeof usePlanStore.getState>['mechanics'];
  uses: ReturnType<typeof usePlanStore.getState>['uses'];
  fightDuration: number;
  onAddAt: (t: number) => void;
}

function BossLaneRow({ laneId, mechanics, uses, fightDuration, onAddAt }: BossLaneRowProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ t: number } | null>(null);

  return (
    <div
      ref={ref}
      className="boss-row-right boss-row-height"
      data-lane-id={laneId}
      onMouseMove={(e) => {
        if ((e.target as HTMLElement).closest('.mechanic')) {
          setHover(null);
          return;
        }
        if (!ref.current) return;
        setHover({ t: xToTime(e.clientX, ref.current, fightDuration) });
      }}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.mechanic')) return;
        if (!ref.current) return;
        onAddAt(xToTime(e.clientX, ref.current, fightDuration));
      }}
    >
      {hover && (
        <div className="boss-hover show" style={{ left: `${pct(hover.t, fightDuration)}%` }}>
          <span className="boss-hover-time">{fmt(hover.t)}</span>
        </div>
      )}
      {mechanics.map((m) => (
        <MechanicMarker key={m.id} mech={m} uses={uses} fightDuration={fightDuration} />
      ))}
    </div>
  );
}
