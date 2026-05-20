import { useRef, useState } from 'react';
import type { Ability, Use } from '../../types';
import { fmt, pct, xToTime } from '../../lib/time';
import { usePlanStore } from '../../state/planStore';
import { CdUse } from './CdUse';

interface AbilityRowProps {
  playerId: string;
  ability: Ability;
  uses: Use[];
  alt: boolean;
  fightDuration: number;
}

let useSeq = 0;

/**
 * Right-side ability row — accepts drops from MitChips (creates a Use) or
 * from existing CdUses on this same row (moves the Use). Drops from a
 * mismatched playerId/abilityId pair are rejected (dragover doesn't
 * preventDefault).
 *
 * Mechanic guidelines rendered here so they cross every ability row.
 */
export function AbilityRow({ playerId, ability, uses, alt, fightDuration }: AbilityRowProps) {
  const dragCtx = usePlanStore((s) => s.dragCtx);
  const addUse = usePlanStore((s) => s.addUse);
  const moveUse = usePlanStore((s) => s.moveUse);
  const mechanics = usePlanStore((s) => s.mechanics);

  const ref = useRef<HTMLDivElement | null>(null);
  const [drop, setDrop] = useState<{ t: number } | null>(null);

  const matches = dragCtx && dragCtx.playerId === playerId && dragCtx.abilityId === ability.id;

  return (
    <div
      ref={ref}
      className={`cd-row-right type-${ability.mit_type} ${alt ? 'alt' : ''} ${drop ? 'drop-target' : ''}`}
      data-player-id={playerId}
      data-ability-id={ability.id}
      onDragOver={(e) => {
        if (!matches || !ref.current) return;
        e.preventDefault(); // accept the drop
        e.dataTransfer.dropEffect = dragCtx!.kind === 'chip' ? 'copy' : 'move';
        setDrop({ t: xToTime(e.clientX, ref.current, fightDuration) });
      }}
      onDragLeave={(e) => {
        if (ref.current && !ref.current.contains(e.relatedTarget as Node | null)) {
          setDrop(null);
        }
      }}
      onDrop={(e) => {
        if (!matches || !ref.current) return;
        e.preventDefault();
        const t = xToTime(e.clientX, ref.current, fightDuration);
        setDrop(null);
        if (dragCtx!.kind === 'chip') {
          addUse({
            id: `use-${Date.now()}-${++useSeq}`,
            player_id: playerId,
            ability_id: ability.id,
            time: t,
          });
        } else if (dragCtx!.kind === 'use' && dragCtx!.useId) {
          moveUse(dragCtx!.useId, t);
        }
      }}
    >
      {mechanics.map((m) => (
        <div
          key={`g-${m.id}`}
          className={`mech-guideline ${m.type}`}
          style={{ left: `${pct(m.time, fightDuration)}%` }}
        />
      ))}

      {drop && (
        <div className="cd-drop show" style={{ left: `${pct(drop.t, fightDuration)}%` }}>
          <span className="cd-drop-time">{fmt(drop.t)}</span>
        </div>
      )}

      {uses
        .filter((u) => u.player_id === playerId && u.ability_id === ability.id)
        .map((u) => (
          <CdUse key={u.id} use={u} ability={ability} fightDuration={fightDuration} />
        ))}
    </div>
  );
}
