import type { Ability } from '../../types';
import { abilityGlyph } from '../../data/glyphFallbacks';
import { usePlanStore } from '../../state/planStore';

interface MitChipProps {
  playerId: string;
  ability: Ability;
}

export function MitChip({ playerId, ability }: MitChipProps) {
  const setDragCtx = usePlanStore((s) => s.setDragCtx);
  const expandPlayer = usePlanStore((s) => s.expandPlayer);

  return (
    <div
      className={`pcm-chip type-${ability.mit_type}`}
      draggable
      data-player-id={playerId}
      data-ability-id={ability.id}
      title={`${ability.name} · ${ability.recast}s · ${ability.mit_potency}%`}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', `${playerId}:${ability.id}`);
        setDragCtx({ kind: 'chip', playerId, abilityId: ability.id });
        expandPlayer(playerId);
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('dragging');
        setDragCtx(null);
      }}
    >
      <div className="chip-icon" style={{ color: 'var(--chip-color)' }}>
        {abilityGlyph(ability.icon)}
      </div>
      <span className="chip-name">{ability.name}</span>
      <span className="chip-cd">{ability.recast}s</span>
    </div>
  );
}
