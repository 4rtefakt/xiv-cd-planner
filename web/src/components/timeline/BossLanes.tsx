import { usePlanStore } from '../../state/planStore';

/**
 * Renders the boss-lane rows BOTH on the left labels column and on the
 * right canvas. Mechanic markers + click-to-add-mechanic come in C.2.
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

export function BossLanesRight() {
  const bossLanes = usePlanStore((s) => s.bossLanes);

  return (
    <div className="right-boss-lanes">
      {bossLanes.map((lane) => (
        <div
          key={lane.id}
          className="boss-row-right boss-row-height"
          data-lane-id={lane.id}
        />
      ))}
    </div>
  );
}
