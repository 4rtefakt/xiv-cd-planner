import type { Ability, Use } from '../../types';
import { fmt, pct } from '../../lib/time';
import { abilityGlyph } from '../../data/glyphFallbacks';
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
        setDragCtx({
          kind: 'use',
          playerId: use.player_id,
          abilityId: use.ability_id,
          useId: use.id,
        });
        e.currentTarget.classList.add('dragging-use');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging-use');
        setDragCtx(null);
      }}
    >
      <div
        className="cd-use-active-block"
        style={{ width: `${activeWidthPct}%`, color: 'var(--cd-color)' }}
      >
        <div className="cd-use-icon" style={{ color: 'var(--cd-color)' }}>
          {abilityGlyph(ability.icon)}
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
