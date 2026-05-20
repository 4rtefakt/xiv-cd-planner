import { useEffect, useRef, useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { fmt, pct, xToTime } from '../../lib/time';
import { computeMechSlots } from '../../lib/mitigation';
import { MechanicMarker } from './Mechanic';

/**
 * Left labels column — one row per boss lane.
 *
 * Click on the lane NAME → inline editable text input. Enter / blur
 * saves, Esc cancels. The lane-num and × stay fixed.
 */
export function BossLanesLeft() {
  const bossLanes = usePlanStore((s) => s.bossLanes);
  const mechanics = usePlanStore((s) => s.mechanics);
  const hiddenCats = usePlanStore((s) => s.hiddenMechCategories);
  const removeBossLane = usePlanStore((s) => s.removeBossLane);
  const setBossLaneName = usePlanStore((s) => s.setBossLaneName);
  const readOnly = usePlanStore((s) => s.readOnly);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="left-boss-lanes">
      {bossLanes.map((lane, idx) => {
        // Match the right column's height by computing the same slot
        // count from the same (filtered) set of mechanics.
        const laneMechs = mechanics.filter(
          (m) => m.lane_id === lane.id && !hiddenCats.includes(m.category),
        );
        const { slotCount } = computeMechSlots(laneMechs);
        return (
        <div
          key={lane.id}
          className="boss-row-left"
          style={{ ['--mech-slots' as any]: slotCount }}
        >
          <span className="lane-num">{String(idx + 1).padStart(2, '0')}</span>
          {editingId === lane.id ? (
            <LaneNameEditor
              initial={lane.name}
              onSave={(v) => {
                setBossLaneName(lane.id, v.trim() || lane.name);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <span
              className={`lane-name${readOnly ? '' : ' lane-name-editable'}`}
              role={readOnly ? undefined : 'button'}
              tabIndex={readOnly ? undefined : 0}
              title={readOnly ? undefined : 'Rename lane'}
              onClick={() => {
                if (readOnly) return;
                setEditingId(lane.id);
              }}
            >
              {lane.name}
            </span>
          )}
          {!readOnly && bossLanes.length > 1 && (
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
        );
      })}
    </div>
  );
}

function LaneNameEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="lane-name-input"
      type="text"
      value={value}
      maxLength={32}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(value);
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(value)}
    />
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
  const hiddenCats = usePlanStore((s) => s.hiddenMechCategories);
  const uses = usePlanStore((s) => s.uses);
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const openModal = usePlanStore((s) => s.openMechanicModal);
  const dragCtx = usePlanStore((s) => s.dragCtx);
  const moveMechanic = usePlanStore((s) => s.moveMechanic);

  // Filter once — the result feeds both per-lane rendering and slot
  // computation, so they stay in sync.
  const visibleMechs = mechanics.filter((m) => !hiddenCats.includes(m.category));

  return (
    <div className="right-boss-lanes">
      {bossLanes.map((lane) => (
        <BossLaneRow
          key={lane.id}
          laneId={lane.id}
          mechanics={visibleMechs.filter((m) => m.lane_id === lane.id)}
          allMechanics={visibleMechs}
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
  const readOnly = usePlanStore((s) => s.readOnly);

  const { slotOf, slotCount } = computeMechSlots(mechanics);

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
      className={`boss-row-right${draggingOurMech ? ' drop-target' : ''}`}
      style={{ ['--mech-slots' as any]: slotCount }}
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
        if (readOnly) return;
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
        <MechanicMarker
          key={m.id}
          mech={m}
          uses={uses}
          fightDuration={fightDuration}
          slot={slotOf.get(m.id) ?? 0}
        />
      ))}
    </div>
  );
}
