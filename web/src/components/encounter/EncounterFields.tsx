import { usePlanStore } from '../../state/planStore';

export function EncounterFields() {
  const encounter = usePlanStore((s) => s.encounter);
  const mechanicsCount = usePlanStore((s) => s.mechanics.length);
  const usesCount = usePlanStore((s) => s.uses.length);
  const setEncounter = usePlanStore((s) => s.setEncounter);

  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="enc-row">
      <div className="enc-field">
        <div className="enc-label">FIGHT NAME</div>
        <input
          className="enc-input"
          type="text"
          value={encounter.fight_name}
          onChange={(e) => setEncounter({ fight_name: e.target.value })}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">DURATION (s)</div>
        <input
          className="enc-input-mono"
          type="number"
          min={60}
          max={900}
          value={encounter.fight_duration}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            const next = Number.isFinite(v) ? Math.max(60, Math.min(900, v)) : 600;
            setEncounter({ fight_duration: next });
          }}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">ILVL</div>
        <input
          className="enc-input-mono"
          type="number"
          value={encounter.party_ilvl ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setEncounter({ party_ilvl: Number.isFinite(v) ? v : null });
          }}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">MECHS</div>
        <div className="enc-value-mono">{pad2(mechanicsCount)}</div>
      </div>
      <div className="enc-field">
        <div className="enc-label">ASSIGNS</div>
        <div className="enc-value-mono">{pad2(usesCount)}</div>
      </div>
    </div>
  );
}
