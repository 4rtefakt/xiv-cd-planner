import type { Mechanic as MechanicT, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { abilityIndex, computeCoverage, deriveMechType } from '../../lib/mitigation';
import { usePlanStore } from '../../state/planStore';
import { useMemo } from 'react';

interface MechanicProps {
  mech: MechanicT;
  uses: Use[];
  fightDuration: number;
}

export function MechanicMarker({ mech, uses, fightDuration }: MechanicProps) {
  const jobs = usePlanStore((s) => s.jobs);
  const partySize = usePlanStore((s) => s.party.length);
  const removeMechanic = usePlanStore((s) => s.removeMechanic);
  const setDragCtx = usePlanStore((s) => s.setDragCtx);
  const openEditMechanic = usePlanStore((s) => s.openEditMechanic);
  const previewUse = usePlanStore((s) => s.previewUse);

  const abilities = useMemo(() => abilityIndex(jobs), [jobs]);
  const coverage = computeCoverage(mech, uses, abilities, partySize);
  const visualType = deriveMechType(mech, partySize);
  const damageKind = mech.damage_kind ?? 'magical';
  const isPlacement = mech.category === 'placement';

  // Would this mechanic be covered by the previewed (hovered) placement?
  // Pure damage and placement can't be covered — skip the highlight.
  let previewCovered = false;
  if (previewUse && !previewUse.conflict && !isPlacement && damageKind !== 'pure') {
    const ab = abilities.get(previewUse.ability_id);
    if (ab && mech.time >= previewUse.time && mech.time < previewUse.time + ab.effect) {
      const mk = ab.mit_kind ?? 'all';
      if (mk === 'all' || mk === damageKind) previewCovered = true;
    }
  }

  // The badge after the name : P/M/✕ for damage, ◇ for placement.
  const kindGlyph = isPlacement
    ? '◇'
    : damageKind === 'physical'
      ? 'P'
      : damageKind === 'magical'
        ? 'M'
        : '✕';
  const kindClass = isPlacement ? 'k-placement' : `k-${damageKind}`;

  return (
    <div
      className={
        `mechanic ${visualType} kind-${damageKind}` +
        (isPlacement ? ' is-placement' : '') +
        (previewCovered ? ' preview-covered' : '')
      }
      style={{ left: `${pct(mech.time, fightDuration)}%` }}
      data-mech-id={mech.id}
      data-category={mech.category}
      data-damage-kind={damageKind}
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
      onClick={(e) => {
        // Don't open the editor if the user clicked × (which has its
        // own handler with stopPropagation). Drag also doesn't fire a
        // click in practice, so this is safe.
        e.stopPropagation();
        openEditMechanic(mech);
      }}
    >
      <div className="mech-cap" />
      <div className="mech-label">
        {mech.name}
        <span className={`mech-kind ${kindClass}`}>{kindGlyph}</span>
      </div>
      <div className="mech-time">{fmt(mech.time)}</div>
      <div className={`mech-coverage cov-${coverage.tier}`}>
        {coverage.placement ? '·' : coverage.pure ? '—' : `${coverage.pct}%`}
      </div>
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
