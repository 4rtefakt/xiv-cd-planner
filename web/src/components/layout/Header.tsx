import { useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { ImportPartyModal } from '../modals/ImportPartyModal';

type CopyKind = 'edit' | 'view' | null;

export function Header() {
  const slug = usePlanStore((s) => s.slug);
  const saveStatus = usePlanStore((s) => s.saveStatus);
  const readOnly = usePlanStore((s) => s.readOnly);
  const [copied, setCopied] = useState<CopyKind>(null);
  const [importOpen, setImportOpen] = useState(false);

  const pillLabel = (() => {
    if (readOnly) return '◇ READ-ONLY';
    switch (saveStatus) {
      case 'saving': return '● SAVING';
      case 'saved':  return '● SAVED';
      case 'error':  return '✕ ERROR';
      default:       return '○ IDLE';
    }
  })();

  function newPlan() {
    // Wipe slug + reset to empty plan and let the next mutation POST a fresh one.
    usePlanStore.getState().setSlug(null);
    usePlanStore.getState().setSaveStatus('idle');
    usePlanStore.getState().setReadOnly(false);
    usePlanStore.getState().hydratePlan({
      encounter: { fight_name: 'NEW FIGHT', fight_duration: 600, party_ilvl: null },
      bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
      mechanics: [],
      uses: [],
    } as any);
    window.history.replaceState({}, '', '/');
  }

  async function copy(kind: 'edit' | 'view') {
    if (!slug) return;
    const url =
      kind === 'view'
        ? `${window.location.origin}/p/${slug}?view=read`
        : `${window.location.origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      window.prompt('Copy this URL:', url);
    }
  }

  function exitReadOnly() {
    // Drop ?view=read from the URL and reload. Triggering a reload is the
    // simplest path — PlanLoader re-runs without setting readOnly.
    if (!slug) return;
    window.location.href = `${window.location.origin}/p/${slug}`;
  }

  return (
    <header className={`header${readOnly ? ' header-readonly' : ''}`}>
      <div className="logo">
        <div className="logo-diamond" />
        COOLDOWN<span className="slash">//</span>PLANNER
      </div>
      <div className="header-right">
        {!readOnly && (
          <>
            <button className="header-btn" type="button" onClick={newPlan} title="Start a fresh plan">+ NEW</button>
            <button className="header-btn" type="button" onClick={() => setImportOpen(true)} title="Paste a JSON party">+ IMPORT PARTY</button>
          </>
        )}
        {slug && (
          <>
            <button
              className={`header-btn header-btn-share${copied === 'edit' ? ' is-copied' : ''}`}
              type="button"
              onClick={() => copy('edit')}
              title="Copy editable link"
            >
              {copied === 'edit' ? '✓ COPIED' : '⟁ EDIT'}
            </button>
            <button
              className={`header-btn header-btn-share${copied === 'view' ? ' is-copied' : ''}`}
              type="button"
              onClick={() => copy('view')}
              title="Copy read-only link"
            >
              {copied === 'view' ? '✓ COPIED' : '⟁ VIEW'}
            </button>
          </>
        )}
        {readOnly && slug && (
          <button className="header-btn header-btn-edit" type="button" onClick={exitReadOnly} title="Switch to edit mode">
            ✎ EDIT
          </button>
        )}
        <div className={`header-save save-${readOnly ? 'readonly' : saveStatus}`}>{pillLabel}</div>
        <div className="header-tag">S9.NET</div>
        <div className="header-tag">V0.1</div>
      </div>
      <ImportPartyModal open={importOpen} onClose={() => setImportOpen(false)} />
    </header>
  );
}
