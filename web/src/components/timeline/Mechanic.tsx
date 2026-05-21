import type { Mechanic as MechanicT, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { abilityIndexAtLevel, computeCoverage, deriveMechType } from '../../lib/mitigation';
import { resolveAbilityAtLevel } from '../../lib/abilityResolve';
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
  const level = usePlanStore((s) => s.encounter.level);
  const hiddenAbilityIds = usePlanStore((s) => s.hiddenAbilityIds);
  const hiddenSet = useMemo(() => new Set(hiddenAbilityIds), [hiddenAbilityIds]);

  const abilities = useMemo(
    () => abilityIndexAtLevel(jobs, level, resolveAbilityAtLevel),
    [jobs, level],
  );
  const coverage = computeCoverage(mech, uses, abilities, partySize, undefined, level, hiddenSet);
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
        }, level, hiddenSet)
      : null;
  const previewCovered = !!previewCov && previewCov.pct > coverage.pct;
  const showingPreview = previewCov && previewCov.pct !== coverage.pct;

  // The "color key" drives the whole mech's color (line, label, cap,
  // coverage badge). One scheme for both : damage_kind for damage
  // mechs (phys/magic/pure), 'placement' for non-damaging cues.
  const colorKey = isPlacement ? 'placement' : damageKind;

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
      data-color={colorKey}
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
      <div className="mech-label" title={`${displayLabel} · ${fmt(mech.time)}`}>
        <span className="mech-label-text">{displayLabel}</span>
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
