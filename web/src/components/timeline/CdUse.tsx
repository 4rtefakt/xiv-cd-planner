import type { Ability, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { AbilityIcon } from '../Icon';
import { usePlanStore } from '../../state/planStore';

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

  const totalPct = (ability.recast / fightDuration) * 100;
  const activeRatio = Math.min(1, ability.effect / ability.recast);
  const activeWidthPct = activeRatio * 100;
  const tipText =
    `${ability.name.toUpperCase()} · ACTIVE ${fmt(use.time)} → ${fmt(use.time + ability.effect)}` +
    ` · CD UNTIL ${fmt(use.time + ability.recast)}`;

  return (
    <div
      className={`cd-use type-${ability.mit_type}`}
      draggable
      style={{
        left: `${pct(use.time, fightDuration)}%`,
        width: `${totalPct}%`,
      }}
      data-use-id={use.id}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `use:${use.id}`);
        // Preserve the grab offset so the use lands where the cursor is,
        // not where the cursor lands relative to the left edge.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const grabOffsetPx = e.clientX - rect.left;
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
    >
      <div
        className="cd-use-active-block"
        style={{ width: `${activeWidthPct}%`, color: 'var(--cd-color)' }}
      >
        <div className="cd-use-icon" style={{ color: 'var(--cd-color)' }}>
          <AbilityIcon src={ability.icon} fallbackGlyph={ability.icon_glyph} alt={ability.name} />
        </div>
        <div className="cd-use-active-extend" />
      </div>
      <div className="cd-use-cooldown" />
      <div className="cd-use-tip">{tipText}</div>
      <div className="cd-use-start-time">{fmt(use.time)}</div>
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
    </div>
  );
}
