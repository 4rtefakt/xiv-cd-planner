import { useEffect, useRef, useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { fmt } from '../../lib/time';
import { mainStart, mainBlock, coordToTime } from '../../lib/orientation';
import { useT } from '../../i18n';

interface PhaseLayerProps {
  fightDuration: number;
  /** true on the HEAD canvas (axis + boss lanes) : renders the labels,
   *  which are draggable / renamable / removable. The BODY canvas only
   *  renders the vertical lines so the two scrollers stay in sync
   *  visually without duplicating the interactive surface. */
  withLabels?: boolean;
}

/** Faint per-phase wash colors, cycled by phase order. Kept very low
 *  alpha — the tint should hint at the phase, never fight the markers or
 *  the ability art on top of it. */
const PHASE_TINTS = [
  'rgba(0, 229, 255, 0.07)',   // cyan
  'rgba(255, 46, 154, 0.07)',  // pink
  'rgba(74, 222, 128, 0.07)',  // green
  'rgba(192, 132, 252, 0.07)', // purple
  'rgba(255, 181, 71, 0.07)',  // amber
  'rgba(96, 165, 250, 0.07)',  // blue
];

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
  const orientation = usePlanStore((s) => s.orientation);
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
      movePhase(phaseId, coordToTime(mv.clientX, mv.clientY, layer, fightDuration, orientation));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Phase REGIONS : each phase paints a faint band from its start to the
  // next phase (or the fight end). Sorted by time so the bands tile in
  // order and the color cycles by position, not insertion order.
  const sorted = [...phases].sort((a, b) => a.time - b.time);

  return (
    <div ref={layerRef} className="phase-layer">
      {sorted.map((p, i) => {
        const start = p.time;
        const end = i + 1 < sorted.length ? sorted[i + 1]!.time : fightDuration;
        const span = Math.max(0, end - start);
        if (span <= 0) return null;
        return (
          <div
            key={`region-${p.id}`}
            className="phase-region"
            style={{ ...mainBlock(start, span, fightDuration, orientation), background: PHASE_TINTS[i % PHASE_TINTS.length] }}
          />
        );
      })}
      {phases.map((p) => (
        <div
          key={p.id}
          className="phase-marker"
          style={mainStart(p.time, fightDuration, orientation)}
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
