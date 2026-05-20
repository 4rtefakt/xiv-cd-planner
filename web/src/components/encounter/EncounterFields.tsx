import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';

export function EncounterFields() {
  const t = useT();
  const encounter = usePlanStore((s) => s.encounter);
  const mechanicsCount = usePlanStore((s) => s.mechanics.length);
  const usesCount = usePlanStore((s) => s.uses.length);
  const setEncounter = usePlanStore((s) => s.setEncounter);
  const readOnly = usePlanStore((s) => s.readOnly);

  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="enc-row">
      <div className="enc-field">
        <div className="enc-label">{t('enc.fightName')}</div>
        <input
          className="enc-input"
          type="text"
          value={encounter.fight_name}
          readOnly={readOnly}
          onChange={(e) => setEncounter({ fight_name: e.target.value })}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">{t('enc.duration')}</div>
        <input
          className="enc-input-mono"
          type="number"
          min={60}
          max={900}
          value={encounter.fight_duration}
          readOnly={readOnly}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            const next = Number.isFinite(v) ? Math.max(60, Math.min(900, v)) : 600;
            setEncounter({ fight_duration: next });
          }}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">{t('enc.ilvl')}</div>
        <input
          className="enc-input-mono"
          type="number"
          value={encounter.party_ilvl ?? ''}
          readOnly={readOnly}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setEncounter({ party_ilvl: Number.isFinite(v) ? v : null });
          }}
        />
      </div>
      <div className="enc-field">
        <div className="enc-label">{t('enc.mechs')}</div>
        <div className="enc-value-mono">{pad2(mechanicsCount)}</div>
      </div>
      <div className="enc-field">
        <div className="enc-label">{t('enc.assigns')}</div>
        <div className="enc-value-mono">{pad2(usesCount)}</div>
      </div>
    </div>
  );
}
