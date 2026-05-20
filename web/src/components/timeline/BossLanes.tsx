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
  const dragCtx = usePlanStore((s) => s.dragCtx);
  const moveMechanic = usePlanStore((s) => s.moveMechanic);

  return (
    <div className="right-boss-lanes">
      {bossLanes.map((lane) => (
        <BossLaneRow
          key={lane.id}
          laneId={lane.id}
          mechanics={mechanics.filter((m) => m.lane_id === lane.id)}
          allMechanics={mechanics}
          uses={uses}
          fightDuration={fightDuration}
          dragCtx={dragCtx}
          onAddAt={(t) => openModal(lane.id, t)}
          onMoveMech={(id, t) => moveMechanic(id, t)}
        />
      ))}
    </div>
  );
}

interface BossLaneRowProps {
  laneId: string;
  mechanics: ReturnType<typeof usePlanStore.getState>['mechanics'];
  allMechanics: ReturnType<typeof usePlanStore.getState>['mechanics'];
  uses: ReturnType<typeof usePlanStore.getState>['uses'];
  fightDuration: number;
  dragCtx: ReturnType<typeof usePlanStore.getState>['dragCtx'];
  onAddAt: (t: number) => void;
  onMoveMech: (id: string, t: number) => void;
}

function BossLaneRow({
  laneId,
  mechanics,
  allMechanics,
  uses,
  fightDuration,
  dragCtx,
  onAddAt,
  onMoveMech,
}: BossLaneRowProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ t: number } | null>(null);

  // Are we hovering this lane while a mechanic from THIS lane is being dragged?
  // Mechanics stay within their own lane on reposition (cross-lane moves
  // would change the mechanic's lane_id, which we don't support here yet).
  const draggingOurMech =
    dragCtx?.kind === 'mech' &&
    dragCtx.mechId != null &&
    allMechanics.find((m) => m.id === dragCtx.mechId)?.lane_id === laneId;

  return (
    <div
      ref={ref}
      className={`boss-row-right boss-row-height${draggingOurMech ? ' drop-target' : ''}`}
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
      // Accept dropped mechanics being repositioned within this lane.
      onDragOver={(e) => {
        if (!draggingOurMech || !ref.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setHover({ t: xToTime(e.clientX, ref.current, fightDuration) });
      }}
      onDragLeave={() => setHover(null)}
      onDrop={(e) => {
        if (!draggingOurMech || !ref.current || !dragCtx?.mechId) return;
        e.preventDefault();
        const t = xToTime(e.clientX, ref.current, fightDuration);
        onMoveMech(dragCtx.mechId, t);
        setHover(null);
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
