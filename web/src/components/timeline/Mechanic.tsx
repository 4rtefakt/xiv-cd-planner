import type { Mechanic as MechanicT, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { computeCoverage } from '../../lib/mitigation';
import { usePlanStore } from '../../state/planStore';
import { abilityIndex } from '../../lib/mitigation';
import { useMemo } from 'react';

interface MechanicProps {
  mech: MechanicT;
  uses: Use[];
  fightDuration: number;
}

export function MechanicMarker({ mech, uses, fightDuration }: MechanicProps) {
  const jobs = usePlanStore((s) => s.jobs);
  const removeMechanic = usePlanStore((s) => s.removeMechanic);
  const setDragCtx = usePlanStore((s) => s.setDragCtx);
  const previewUse = usePlanStore((s) => s.previewUse);

  const abilities = useMemo(() => abilityIndex(jobs), [jobs]);
  const coverage = computeCoverage(mech, uses, abilities);

  // Would this mechanic be covered by the previewed (hovered) placement?
  let previewCovered = false;
  if (previewUse && !previewUse.conflict) {
    const ab = abilities.get(previewUse.ability_id);
    if (ab && mech.time >= previewUse.time && mech.time < previewUse.time + ab.effect) {
      previewCovered = true;
    }
  }

  return (
    <div
      className={`mechanic ${mech.type}${previewCovered ? ' preview-covered' : ''}`}
      style={{ left: `${pct(mech.time, fightDuration)}%` }}
      data-mech-id={mech.id}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `mech:${mech.id}`);
        setDragCtx({ kind: 'mech', mechId: mech.id });
        e.currentTarget.classList.add('dragging-mech');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging-mech');
        setDragCtx(null);
      }}
    >
      <div className="mech-cap" />
      <div className="mech-label">{mech.name}</div>
      <div className="mech-time">{fmt(mech.time)}</div>
      <div className={`mech-coverage cov-${coverage.tier}`}>{coverage.pct}%</div>
      <span
        className="mech-remove"
        role="button"
        tabIndex={0}
        title="Remove"
        onClick={(e) => {
          e.stopPropagation();
          removeMechanic(mech.id);
        }}
      >
        ×
      </span>
    </div>
  );
}
