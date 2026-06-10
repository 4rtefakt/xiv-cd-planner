import { useEffect, useRef, useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { fmt, pct, xToTime } from '../../lib/time';
import { useT } from '../../i18n';

interface PhaseLayerProps {
  fightDuration: number;
  /** true on the HEAD canvas (axis + boss lanes) : renders the labels,
   *  which are draggable / renamable / removable. The BODY canvas only
   *  renders the vertical lines so the two scrollers stay in sync
   *  visually without duplicating the interactive surface. */
  withLabels?: boolean;
}

/**
 * Phase markers — vertical dashed lines spanning the whole canvas, one
 * per plan phase (P1, P2, INTERMISSION, …).
 *
 * Interactions (label, head canvas only) :
 *   - drag        → move the phase along the time axis
 *   - double-click → inline rename
 *   - right-click  → remove
 */
export function PhaseLayer({ fightDuration, withLabels = false }: PhaseLayerProps) {
  const phases = usePlanStore((s) => s.phases);
  const movePhase = usePlanStore((s) => s.movePhase);
  const removePhase = usePlanStore((s) => s.removePhase);
  const setPhaseName = usePlanStore((s) => s.setPhaseName);
  const readOnly = usePlanStore((s) => s.readOnly);
  const layerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = useT();

  if (phases.length === 0) return null;

  function startDrag(e: React.MouseEvent, phaseId: string) {
    if (readOnly || !layerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const layer = layerRef.current;
    const onMove = (mv: MouseEvent) => {
      movePhase(phaseId, xToTime(mv.clientX, layer, fightDuration));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div ref={layerRef} className="phase-layer">
      {phases.map((p) => (
        <div
          key={p.id}
          className="phase-marker"
          style={{ left: `${pct(p.time, fightDuration)}%` }}
        >
          {withLabels &&
            (editingId === p.id ? (
              <PhaseNameEditor
                initial={p.name}
                onSave={(v) => {
                  setPhaseName(p.id, v.trim() || p.name);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <span
                className="phase-label"
                title={`${p.name} · ${fmt(p.time)}${readOnly ? '' : ` — ${t('phase.hint')}`}`}
                onMouseDown={(e) => startDrag(e, p.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setEditingId(p.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!readOnly) removePhase(p.id);
                }}
              >
                {p.name}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

function PhaseNameEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="phase-name-input"
      type="text"
      value={value}
      maxLength={24}
      onChange={(e) => setValue(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(value);
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(value)}
    />
  );
}
