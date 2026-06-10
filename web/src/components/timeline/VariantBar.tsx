import { useEffect, useRef, useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';

/**
 * Pull-variant tabs (multi-pull, inc.1 — see docs/design/multi-pull.md).
 *
 * Each tab is a named pull ("PULL #1", "PULL #2", …). The active tab's
 * mechanics/uses are what the timeline below edits. Interactions :
 *   - click         → switch to that pull
 *   - double-click  → inline rename (active tab only)
 *   - right-click   → remove (disabled on the last remaining pull)
 *   - [+ PULL]      → duplicate the active pull into a new variant
 *
 * Hidden entirely in read-only view and while there's a single pull with
 * the default name (so legacy / single-pull plans see no new chrome until
 * they opt in by adding a second pull).
 */
export function VariantBar() {
  const variants = usePlanStore((s) => s.variants);
  const activeVariantId = usePlanStore((s) => s.activeVariantId);
  const switchVariant = usePlanStore((s) => s.switchVariant);
  const addVariant = usePlanStore((s) => s.addVariant);
  const removeVariant = usePlanStore((s) => s.removeVariant);
  const renameVariant = usePlanStore((s) => s.renameVariant);
  const readOnly = usePlanStore((s) => s.readOnly);
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = useT();

  // Single default pull + read-only → don't show the bar at all.
  const isDefaultSingle =
    variants.length === 1 && (variants[0]?.name === 'PULL #1' || variants[0]?.name === '');
  if (readOnly && isDefaultSingle) return null;

  return (
    <div className="variant-bar">
      <span className="tl-tool-label">{t('variant.label')}</span>
      {variants.map((v) => {
        const isActive = v.id === activeVariantId;
        if (editingId === v.id) {
          return (
            <VariantNameEditor
              key={v.id}
              initial={v.name}
              onSave={(val) => {
                renameVariant(v.id, val.trim() || v.name);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          );
        }
        return (
          <button
            type="button"
            key={v.id}
            className={`variant-tab${isActive ? ' active' : ''}`}
            title={readOnly ? v.name : `${v.name} — ${t('variant.tabHint')}`}
            onClick={() => switchVariant(v.id)}
            onDoubleClick={() => {
              if (!readOnly && isActive) setEditingId(v.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!readOnly && variants.length > 1) removeVariant(v.id);
            }}
          >
            {v.name}
          </button>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          className="variant-add"
          onClick={addVariant}
          title={t('variant.addHint')}
        >
          {t('variant.add')}
        </button>
      )}
    </div>
  );
}

function VariantNameEditor({
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
      className="variant-name-input"
      type="text"
      value={value}
      maxLength={24}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(value);
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(value)}
    />
  );
}
