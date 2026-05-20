import type { Ability } from '../../types';
import { abilityGlyph } from '../../data/glyphFallbacks';

interface MitChipProps {
  playerId: string;
  ability: Ability;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function MitChip({ playerId, ability, onDragStart }: MitChipProps) {
  return (
    <div
      className={`pcm-chip type-${ability.mit_type}`}
      draggable
      data-player-id={playerId}
      data-ability-id={ability.id}
      title={`${ability.name} · ${ability.recast}s · ${ability.mit_potency}%`}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData(
          'application/x-cooldown-chip',
          JSON.stringify({ kind: 'chip', playerId, abilityId: ability.id }),
        );
        e.currentTarget.classList.add('dragging');
        onDragStart?.(e);
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
    >
      <div className="chip-icon" style={{ color: 'var(--chip-color)' }}>
        {abilityGlyph(ability.icon)}
      </div>
      <span className="chip-name">{ability.name}</span>
      <span className="chip-cd">{ability.recast}s</span>
    </div>
  );
}
