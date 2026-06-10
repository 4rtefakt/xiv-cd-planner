import { useRef } from 'react';
import type { Ability, Use } from '../../types';
import { fmt } from '../../lib/time';
import { mainStart, mainBlock, mainExtentPct, coordToTime, type Orientation } from '../../lib/orientation';
import { findUseConflict } from '../../lib/mitigation';
import { usePlanStore } from '../../state/planStore';
import { abilityName } from '../../i18n';
import { CdUse } from './CdUse';

interface AbilityRowProps {
  playerId: string;
  ability: Ability;
  uses: Use[];
  alt: boolean;
  fightDuration: number;
}

let useSeq = 0;

/** When the cursor is within this many seconds of a mech, snap the
 *  preview time to that mech. Small enough that the user can still
 *  drop a CD a few seconds before/after a mech if they really want. */
const SNAP_THRESHOLD_S = 3;

/**
 * Right-side ability row.
 *
 * Click-to-place pipeline (Phase D.2): hovering shows a ghost CdUse +
 * highlights covered mechanics; clicking commits the Use (rejected if
 * the recast window would overlap an existing use on the same row).
 *
 * Drag-to-reposition (Phase C.3) still works on existing CdUses — drop
 * within the same row moves the use. Drops onto a different row are
 * rejected by the dragover preventDefault gate.
 */
export function AbilityRow({ playerId, ability, uses, alt, fightDuration }: AbilityRowProps) {
  const dragCtx = usePlanStore((s) => s.dragCtx);
  const previewUse = usePlanStore((s) => s.previewUse);
  const setPreviewUse = usePlanStore((s) => s.setPreviewUse);
  const addUse = usePlanStore((s) => s.addUse);
  const moveUse = usePlanStore((s) => s.moveUse);
  const mechanicsAll = usePlanStore((s) => s.mechanics);
  const hiddenCats = usePlanStore((s) => s.hiddenMechCategories);
  const readOnly = usePlanStore((s) => s.readOnly);
  const orientation = usePlanStore((s) => s.orientation);

  // Apply the same category filter as the boss lane so guidelines
  // disappear in lockstep with the mech markers above.
  const mechanics = mechanicsAll.filter((m) => !hiddenCats.includes(m.category));

  const ref = useRef<HTMLDivElement | null>(null);
  const rowUses = uses.filter((u) => u.player_id === playerId && u.ability_id === ability.id);

  const matchesUseDrag =
    dragCtx?.kind === 'use' &&
    dragCtx.playerId === playerId &&
    dragCtx.abilityId === ability.id;

  const previewMatchesThisRow =
    previewUse && previewUse.player_id === playerId && previewUse.ability_id === ability.id;

  // For new placements (click-to-place hover), excludeUseId is undefined.
  // For drags of an existing use, we exclude it so the use doesn't
  // self-conflict against its own current recast window.
  function computePreviewAt(clientX: number, clientY: number, excludeUseId?: string) {
    if (!ref.current) return null;
    // If the user grabbed the use 25px from its leading edge, we want the
    // use to LAND such that that edge stays 25px before the cursor —
    // preserve the visual grab anchor. The offset is along the main axis
    // (X horizontal, Y vertical), so subtract it from the matching coord.
    const offsetPx = matchesUseDrag ? dragCtx?.grabOffsetPx ?? 0 : 0;
    const px = orientation === 'vertical' ? clientX : clientX - offsetPx;
    const py = orientation === 'vertical' ? clientY - offsetPx : clientY;
    const rawTime = coordToTime(px, py, ref.current, fightDuration, orientation);
    // Snap to a nearby mech if one is within SNAP_THRESHOLD_S — saves
    // the user from pixel-perfect aim when they want the CD to start
    // exactly when the mech fires.
    let time = rawTime;
    let snapped = false;
    let bestDelta = SNAP_THRESHOLD_S + 1;
    for (const m of mechanics) {
      const d = Math.abs(m.time - rawTime);
      if (d <= SNAP_THRESHOLD_S && d < bestDelta) {
        bestDelta = d;
        time = m.time;
        snapped = true;
      }
    }
    const conflict =
      findUseConflict(playerId, ability.id, time, ability.recast, rowUses, excludeUseId) !== null;
    return {
      player_id: playerId,
      ability_id: ability.id,
      time,
      conflict,
      excludeUseId,
      snapped,
    };
  }

  return (
    <div
      ref={ref}
      className={
        `cd-row-right type-${ability.mit_type} ${alt ? 'alt' : ''}` +
        (matchesUseDrag ? ' drop-target' : '') +
        (previewMatchesThisRow ? ' preview-target' : '') +
        (previewMatchesThisRow && previewUse?.conflict ? ' preview-conflict' : '')
      }
      data-player-id={playerId}
      data-ability-id={ability.id}
      // --- Click-to-place hover ---
      onMouseMove={(e) => {
        if (readOnly) return;
        // Suppress preview while a CdUse drag is in progress.
        if (dragCtx) return;
        const p = computePreviewAt(e.clientX, e.clientY);
        if (p) setPreviewUse(p);
      }}
      onMouseLeave={() => setPreviewUse(null)}
      onClick={(e) => {
        if (readOnly) return;
        // Ignore clicks landing on an existing CdUse (its own handlers run).
        // The preview ghost is pointer-events:none in CSS, but we also
        // gate via class name in case that ever changes.
        const inUse = (e.target as HTMLElement).closest('.cd-use');
        if (inUse && !inUse.classList.contains('cd-use-preview')) return;
        const p = computePreviewAt(e.clientX, e.clientY);
        if (!p) return;
        if (p.conflict) return; // visual rejection only; no use added
        addUse({
          id: `use-${Date.now()}-${++useSeq}`,
          player_id: playerId,
          ability_id: ability.id,
          time: p.time,
        });
        // Clear the preview so the just-placed use replaces the ghost
        // cleanly. The next mousemove will re-establish a fresh preview
        // (typically a conflict, since the user's cursor is now over
        // the new CdUse's recast window).
        setPreviewUse(null);
      }}
      // --- Drag-to-reposition existing CdUse (C.3 + E.B preview) ---
      onDragOver={(e) => {
        if (!matchesUseDrag || !ref.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Show the same ghost + mech-covered highlight as click-to-place,
        // anchored to the grab-offset rather than the cursor.
        const p = computePreviewAt(e.clientX, e.clientY, dragCtx?.useId);
        if (p) setPreviewUse(p);
      }}
      onDragLeave={(e) => {
        if (!matchesUseDrag || !ref.current) return;
        // Only clear if we truly left the row — dragover fires on every
        // child element transition, so verify with relatedTarget.
        if (!ref.current.contains(e.relatedTarget as Node | null)) {
          setPreviewUse(null);
        }
      }}
      onDrop={(e) => {
        if (!matchesUseDrag || !ref.current) return;
        e.preventDefault();
        const offsetPx = dragCtx?.grabOffsetPx ?? 0;
        const px = orientation === 'vertical' ? e.clientX : e.clientX - offsetPx;
        const py = orientation === 'vertical' ? e.clientY - offsetPx : e.clientY;
        const t = coordToTime(px, py, ref.current, fightDuration, orientation);
        const conflict =
          findUseConflict(playerId, ability.id, t, ability.recast, rowUses, dragCtx?.useId) !== null;
        if (!conflict && dragCtx?.useId) moveUse(dragCtx.useId, t);
        setPreviewUse(null);
      }}
    >
      {mechanics.map((m) => (
        <div
          key={`g-${m.id}`}
          className={`mech-guideline ${m.type}`}
          style={mainStart(m.time, fightDuration, orientation)}
        />
      ))}

      {previewMatchesThisRow && (
        <PreviewGhost
          time={previewUse!.time}
          conflict={previewUse!.conflict}
          snapped={previewUse!.snapped ?? false}
          ability={ability}
          fightDuration={fightDuration}
          orientation={orientation}
        />
      )}

      {rowUses.map((u) => (
        <CdUse key={u.id} use={u} ability={ability} fightDuration={fightDuration} />
      ))}
    </div>
  );
}

function PreviewGhost({
  time,
  conflict,
  snapped,
  ability,
  fightDuration,
  orientation,
}: {
  time: number;
  conflict: boolean;
  snapped: boolean;
  ability: Ability;
  fightDuration: number;
  orientation: Orientation;
}) {
  const lang = usePlanStore((s) => s.lang);
  // Same end-of-fight clipping as CdUse so the ghost previews exactly
  // what will be rendered once committed.
  const visibleS = Math.max(0, Math.min(ability.recast, fightDuration - time));
  const activeExtentPct = (visibleS > 0 ? Math.min(1, ability.effect / visibleS) : 0) * 100;
  return (
    <div
      className={
        `cd-use cd-use-preview type-${ability.mit_type}` +
        (conflict ? ' is-conflict' : '') +
        (snapped ? ' is-snapped' : '')
      }
      style={{ ...mainBlock(time, visibleS, fightDuration, orientation), pointerEvents: 'none' }}
      aria-hidden
    >
      <div className="cd-use-active-block" style={mainExtentPct(activeExtentPct, orientation)}>
        <div className="cd-use-active-extend" />
      </div>
      <div className="cd-use-cooldown" />
      <div className="cd-use-preview-tip">
        {conflict
          ? `${lang === 'fr' ? 'CONFLIT' : 'CONFLICT'} · ${fmt(time)}`
          : `${abilityName(ability, lang).toUpperCase()}${snapped ? ' ⟁' : ''} · ${fmt(time)} → ${fmt(time + ability.effect)}`}
      </div>
    </div>
  );
}
