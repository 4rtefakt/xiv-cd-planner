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

  const abilities = useMemo(() => abilityIndex(jobs), [jobs]);
  const coverage = computeCoverage(mech, uses, abilities);

  return (
    <div
      className={`mechanic ${mech.type}`}
      style={{ left: `${pct(mech.time, fightDuration)}%` }}
      data-mech-id={mech.id}
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
