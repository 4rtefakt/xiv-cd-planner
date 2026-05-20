import { useEffect, useRef, useState } from 'react';
import type { MechType } from '../../types';
import { fmt, parseTime } from '../../lib/time';
import { usePlanStore } from '../../state/planStore';

const TYPES: { key: MechType; label: string }[] = [
  { key: 'raidwide',   label: 'RAIDWIDE' },
  { key: 'tankbuster', label: 'TANKBUSTER' },
  { key: 'autos',      label: 'AUTOS' },
  { key: 'custom',     label: 'CUSTOM' },
];

let mechSeq = 0;

export function AddMechanicModal() {
  const modal = usePlanStore((s) => s.mechanicModal);
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const close = usePlanStore((s) => s.closeMechanicModal);
  const addMechanic = usePlanStore((s) => s.addMechanic);

  const [name, setName] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [type, setType] = useState<MechType>('raidwide');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modal) return;
    setName('');
    setTimeStr(fmt(modal.time));
    setType(modal.type);
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') confirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, name, timeStr, type]);

  if (!modal) return null;

  function confirm() {
    if (!modal) return;
    const t = Math.max(0, Math.min(fightDuration, parseTime(timeStr)));
    const finalName = (name.trim() || 'UNNAMED').toUpperCase();
    addMechanic({
      id: `mech-${Date.now()}-${++mechSeq}`,
      lane_id: modal.laneId,
      name: finalName,
      time: t,
      type,
    });
    close();
  }

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">◆ ADD MECHANIC</div>
        <div className="modal-body">
          <div className="modal-row">
            <label className="modal-label">Name</label>
            <input
              ref={nameRef}
              className="modal-input"
              type="text"
              placeholder="e.g. Brutal Impact"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="modal-row">
            <label className="modal-label">Timestamp</label>
            <input
              className="modal-input"
              type="text"
              placeholder="0:00"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
            />
          </div>
          <div className="modal-row">
            <label className="modal-label">Damage Type</label>
            <div className="type-grid">
              {TYPES.map((t) => (
                <div
                  key={t.key}
                  className={`type-opt t-${t.key}${type === t.key ? ' selected' : ''}`}
                  onClick={() => setType(t.key)}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-btn" onClick={close}>CANCEL</button>
          <button type="button" className="modal-btn primary" onClick={confirm}>CONFIRM</button>
        </div>
      </div>
    </div>
  );
}
