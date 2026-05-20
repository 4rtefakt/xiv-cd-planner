import type { Mechanic as MechanicT, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { abilityIndex, computeCoverage, deriveMechType } from '../../lib/mitigation';
import { splitMechName } from '../../lib/mechRender';
import { usePlanStore } from '../../state/planStore';
import { useMemo } from 'react';

interface MechanicProps {
  mech: MechanicT;
  uses: Use[];
  fightDuration: number;
  /** Vertical slot for stacking labels when multiple mechs cluster in
   *  time. 0 = baseline (default), 1+ = shifted down by 22px × slot. */
  slot?: number;
}

export function MechanicMarker({ mech, uses, fightDuration, slot = 0 }: MechanicProps) {
  const jobs = usePlanStore((s) => s.jobs);
  const partySize = usePlanStore((s) => s.party.length);
  const removeMechanic = usePlanStore((s) => s.removeMechanic);
  const setDragCtx = usePlanStore((s) => s.setDragCtx);
  const openEditMechanic = usePlanStore((s) => s.openEditMechanic);
  const previewUse = usePlanStore((s) => s.previewUse);
  const readOnly = usePlanStore((s) => s.readOnly);

  const abilities = useMemo(() => abilityIndex(jobs), [jobs]);
  const coverage = computeCoverage(mech, uses, abilities, partySize);
  const visualType = deriveMechType(mech, partySize);
  const damageKind = mech.damage_kind ?? 'magical';
  const isPlacement = mech.category === 'placement';
  const { label: displayLabel, hitCount } = splitMechName(mech);

  // Hypothetical coverage if the user committed the currently-previewed
  // placement. We compute it ONLY when a meaningful preview exists, so
  // the comparison stays cheap.
  const previewCov =
    previewUse && !previewUse.conflict && !isPlacement && damageKind !== 'pure'
      ? computeCoverage(mech, uses, abilities, partySize, {
          ability_id: previewUse.ability_id,
          time: previewUse.time,
          exclude_use_id: previewUse.excludeUseId,
        })
      : null;
  const previewCovered = !!previewCov && previewCov.pct > coverage.pct;
  const showingPreview = previewCov && previewCov.pct !== coverage.pct;

  // Placement gets a ◇ glyph in the label since the cap color is the
  // same grey as "no damage" — without the glyph the user couldn't
  // tell a placement marker apart from a barely-visible mech. Damage
  // mechs OMIT the kind glyph since the cap is already colored
  // (phys=amber, magic=violet, pure=grey) — redundant info.
  const kindGlyph = isPlacement ? '◇' : null;
  const kindClass = isPlacement ? 'k-placement' : `k-${damageKind}`;

  return (
    <div
      className={
        `mechanic ${visualType} kind-${damageKind}` +
        (isPlacement ? ' is-placement' : '') +
        (previewCovered ? ' preview-covered' : '')
      }
      style={{ left: `${pct(mech.time, fightDuration)}%`, ['--mech-slot' as any]: slot }}
      data-mech-id={mech.id}
      data-category={mech.category}
      data-slot={slot}
      data-damage-kind={damageKind}
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) { e.preventDefault(); return; }
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
        if (readOnly) return;
        openEditMechanic(mech);
      }}
    >
      <div className="mech-cap">
        {/* ×N as a superscript over the cap when the mech aggregates
            multiple FFLogs damage events. Kept compact so it doesn't
            bloat the label below. */}
        {hitCount > 1 && <span className="mech-hitcount">×{hitCount}</span>}
      </div>
      <div className="mech-label" title={displayLabel}>
        <span className="mech-label-text">{displayLabel}</span>
        {kindGlyph && <span className={`mech-kind ${kindClass}`}>{kindGlyph}</span>}
      </div>
      <div className="mech-time">{fmt(mech.time)}</div>
      {/* Coverage badge : skipped when there's nothing meaningful to
          show (damage mech at 0% with no preview) to reduce visual
          noise on freshly-imported timelines. */}
      {(coverage.placement
        || coverage.pure
        || coverage.pct > 0
        || showingPreview) && (
        <div
          className={
            `mech-coverage cov-${showingPreview ? previewCov!.tier : coverage.tier}` +
            (showingPreview ? ' is-preview' : '')
          }
        >
          {coverage.placement
            ? '·'
            : coverage.pure
              ? '—'
              : showingPreview
                ? (
                  <>
                    <span className="cov-from">{coverage.pct}</span>
                    <span className="cov-arrow">→</span>
                    <span className="cov-to">{previewCov!.pct}%</span>
                  </>
                )
                : `${coverage.pct}%`}
        </div>
      )}
      {!readOnly && (
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
      )}
    </div>
  );
}
