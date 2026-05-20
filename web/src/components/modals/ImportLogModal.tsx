import { useEffect, useRef, useState } from 'react';
import { api, type FFLogsFight, type FFLogsFightData, type FFLogsReport } from '../../api/client';
import { fmt } from '../../lib/time';
import { usePlanStore } from '../../state/planStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Three-step modal :
 *   1. Paste an FFLogs URL → LOAD → fetch report + fight list
 *   2. Click a fight → fetch its mechanics → show preview
 *   3. IMPORT → store.importFightFromLog → modal closes
 */
export function ImportLogModal({ open, onClose }: Props) {
  const importFightFromLog = usePlanStore((s) => s.importFightFromLog);

  const [url, setUrl] = useState('');
  const [report, setReport] = useState<FFLogsReport | null>(null);
  const [selected, setSelected] = useState<FFLogsFight | null>(null);
  const [preview, setPreview] = useState<FFLogsFightData | null>(null);
  const [loading, setLoading] = useState<'report' | 'fight' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl('');
    setReport(null);
    setSelected(null);
    setPreview(null);
    setLoading(null);
    setError(null);
    const t = setTimeout(() => urlRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function loadReport() {
    setError(null);
    setLoading('report');
    setReport(null);
    setSelected(null);
    setPreview(null);
    try {
      const r = await api.fflogsReport(url);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function pickFight(f: FFLogsFight) {
    if (!report) return;
    setError(null);
    setLoading('fight');
    setSelected(f);
    setPreview(null);
    try {
      const d = await api.fflogsFight(report.code, f.id);
      setPreview(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  function confirm() {
    if (!preview) return;
    importFightFromLog({
      fightName: preview.fightName,
      fightDuration: preview.fightDuration,
      mechanics: preview.mechanics,
    });
    onClose();
  }

  return (
    <div
      className="modal-backdrop show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">◆ IMPORT FROM FFLOGS</div>
        <div className="modal-body">
          <div className="modal-row">
            <label className="modal-label">FFLogs URL or report code</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={urlRef}
                className="modal-input"
                type="text"
                placeholder="https://www.fflogs.com/reports/abcDEF123"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !loading) loadReport();
                }}
              />
              <button
                type="button"
                className="modal-btn primary"
                disabled={!url.trim() || loading === 'report'}
                onClick={loadReport}
              >
                {loading === 'report' ? '...' : 'LOAD'}
              </button>
            </div>
          </div>

          {error && <div className="modal-error">{error}</div>}

          {report && (
            <div className="modal-row">
              <div className="modal-label">
                {report.title}
                {report.owner ? <span style={{ opacity: 0.6 }}> · by {report.owner}</span> : null}
              </div>
              <div className="fflogs-fights">
                {report.fights.length === 0 && (
                  <div className="fflogs-empty">No encounter fights in this report.</div>
                )}
                {report.fights.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`fflogs-fight${selected?.id === f.id ? ' on' : ''}${f.kill ? ' kill' : ''}`}
                    onClick={() => pickFight(f)}
                  >
                    <span className="ff-fight-status">{f.kill ? '✓' : '✕'}</span>
                    <span className="ff-fight-name">{f.name}</span>
                    <span className="ff-fight-dur">{fmt(Math.round(f.duration / 1000))}</span>
                    {f.fightPercentage !== null && !f.kill && (
                      <span className="ff-fight-pct">{f.fightPercentage.toFixed(1)}%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading === 'fight' && <div className="modal-hint">Loading fight events…</div>}

          {preview && (
            <div className="modal-row">
              <div className="modal-label">
                Preview · {preview.mechanics.length} mechanic{preview.mechanics.length === 1 ? '' : 's'}{' '}
                in {fmt(preview.fightDuration)}
              </div>
              <div className="fflogs-preview">
                {preview.mechanics.slice(0, 80).map((m, i) => (
                  <div key={i} className="fflogs-mech">
                    <span className="ff-mech-time">{fmt(Math.round(m.time))}</span>
                    <span className={`ff-mech-kind k-${m.damage_kind}`}>
                      {m.damage_kind === 'physical' ? 'P' : m.damage_kind === 'magical' ? 'M' : '✕'}
                    </span>
                    <span className="ff-mech-name">{m.name}</span>
                    <span className="ff-mech-targets">
                      {m.targetNames.length} target{m.targetNames.length === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
                {preview.mechanics.length > 80 && (
                  <div className="fflogs-more">… +{preview.mechanics.length - 80} more</div>
                )}
              </div>
              <div className="modal-hint">
                Targets are mapped heuristically : full party → raidwide,
                single hit → MT. Anything in between leaves targets empty
                so you can fill them in by clicking the mech in the timeline.
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div style={{ flex: 1 }} />
          <button type="button" className="modal-btn" onClick={onClose}>CANCEL</button>
          <button
            type="button"
            className="modal-btn primary"
            disabled={!preview || preview.mechanics.length === 0}
            onClick={confirm}
            title={preview && preview.mechanics.length === 0 ? 'No mechs found in this fight (very short pull or parse miss)' : ''}
          >
            IMPORT
          </button>
        </div>
      </div>
    </div>
  );
}
