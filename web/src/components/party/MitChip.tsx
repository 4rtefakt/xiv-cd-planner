import type { Ability } from '../../types';
import { AbilityIcon } from '../Icon';

interface MitChipProps {
  playerId: string;
  ability: Ability;
}

/**
 * Static display chip in the party panel. Click-to-place replaces the
 * earlier drag/drop pipeline (see Phase D.2) — this chip is now a
 * visual reference only; the actual placement happens in AbilityRow.
 */
export function MitChip({ ability }: MitChipProps) {
  return (
    <div
      className={`pcm-chip type-${ability.mit_type}`}
      title={`${ability.name} · ${ability.recast}s · ${ability.mit_potency}%`}
    >
      <div className="chip-icon" style={{ color: 'var(--chip-color)' }}>
        <AbilityIcon src={ability.icon} fallbackGlyph={ability.icon_glyph} alt={ability.name} />
      </div>
      <span className="chip-name">{ability.name}</span>
      <span className="chip-cd">{ability.recast}s</span>
    </div>
  );
}
