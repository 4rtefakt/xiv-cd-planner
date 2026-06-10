import type { Ability, Use } from '../../types';
import { fmt } from '../../lib/time';
import { mainBlock, mainExtentPct } from '../../lib/orientation';
import { AbilityIcon } from '../Icon';
import { usePlanStore } from '../../state/planStore';
import { abilityName } from '../../i18n';

interface CdUseProps {
  use: Use;
  ability: Ability;
  fightDuration: number;
}

/**
 * Single placed cooldown on an ability row.
 *
 * Total width = recast (in % of fight duration).
 * Inside:
 *   - active block: effect/recast ratio of total width, solid color +
 *     icon + white right-edge marker
 *   - cooldown block: rest of total width, translucent + 45° striped
 */
export function CdUse({ use, ability, fightDuration }: CdUseProps) {
  const setDragCtx = usePlanStore((s) => s.setDragCtx);
  const removeUse = usePlanStore((s) => s.removeUse);
  const orientation = usePlanStore((s) => s.orientation);

  // Visual width is CLIPPED at the end of the fight : a 120s recast
  // placed at T-30s renders 30s wide instead of stretching the canvas
  // past the boss timeline (which desynced the two scrollers). Conflict
  // detection still uses the full recast — only the render is clipped.
  const visibleS = Math.max(0, Math.min(ability.recast, fightDuration - use.time));
  const activeRatio = visibleS > 0 ? Math.min(1, ability.effect / visibleS) : 0;
  // Fraction of the use occupied by its ACTIVE window (vs the cooldown
  // tail). Projected onto width (horizontal) or height (vertical) below.
  const activeExtentPct = activeRatio * 100;
  const lang = usePlanStore((s) => s.lang);
  const localName = abilityName(ability, lang);
  const activeLabel = lang === 'fr' ? 'ACTIVE' : 'ACTIVE';
  const tipText =
    `${localName.toUpperCase()} · ${activeLabel} ${fmt(use.time)} → ${fmt(use.time + ability.effect)}` +
    ` · CD UNTIL ${fmt(use.time + ability.recast)}`;

  return (
    <div
      className={`cd-use type-${ability.mit_type}`}
      draggable={!usePlanStore.getState().readOnly}
      style={mainBlock(use.time, visibleS, fightDuration, orientation)}
      data-use-id={use.id}
      onDragStart={(e) => {
        if (usePlanStore.getState().readOnly) { e.preventDefault(); return; }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `use:${use.id}`);
        // Preserve the grab offset so the use lands where the cursor is,
        // not where the cursor lands relative to the leading edge. The
        // offset is measured along the main (time) axis : X horizontal,
        // Y vertical.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const grabOffsetPx =
          orientation === 'vertical' ? e.clientY - rect.top : e.clientX - rect.left;
        setDragCtx({
          kind: 'use',
          playerId: use.player_id,
          abilityId: use.ability_id,
          useId: use.id,
          grabOffsetPx,
        });
        e.currentTarget.classList.add('dragging-use');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging-use');
        setDragCtx(null);
        // Clear any lingering preview-ghost if the drop happened outside
        // a matching ability row (onDrop in the row clears it normally).
        usePlanStore.getState().setPreviewUse(null);
      }}
      // Right-click anywhere on the use removes it. preventDefault stops
      // the native context menu — there's no other use for it here.
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (usePlanStore.getState().readOnly) return;
        removeUse(use.id);
      }}
    >
      <div
        className="cd-use-active-block"
        style={{ ...mainExtentPct(activeExtentPct, orientation), color: 'var(--cd-color)' }}
      >
        <div className="cd-use-icon" style={{ color: 'var(--cd-color)' }}>
          <AbilityIcon src={ability.icon} fallbackGlyph={ability.icon_glyph} alt={localName} />
        </div>
        <div className="cd-use-active-extend" />
      </div>
      <div className="cd-use-cooldown" />
      <div className="cd-use-tip">{tipText}</div>
      <div className="cd-use-start-time">{fmt(use.time)}</div>
      {!usePlanStore.getState().readOnly && (
        <span
          className="cd-use-remove"
          role="button"
          tabIndex={0}
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            removeUse(use.id);
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}
