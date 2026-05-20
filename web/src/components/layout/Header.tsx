import { useState } from 'react';
import { usePlanStore } from '../../state/planStore';

export function Header() {
  const slug = usePlanStore((s) => s.slug);
  const saveStatus = usePlanStore((s) => s.saveStatus);
  const [copied, setCopied] = useState(false);

  const pillLabel = (() => {
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
    usePlanStore.getState().hydratePlan({
      encounter: { fight_name: 'NEW FIGHT', fight_duration: 600, party_ilvl: null },
      bossLanes: [{ id: 'lane-1', name: 'BOSS A' }],
      mechanics: [],
      uses: [],
      // keep party as-is so the user doesn't have to re-pick jobs
    } as any);
    // hydratePlan would have set _skipNextSave true ; the user's first
    // actual edit will then POST a fresh plan and rewrite the URL.
    window.history.replaceState({}, '', '/');
  }

  async function copyLink() {
    if (!slug) return;
    const url = `${window.location.origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for older browsers — just select the URL bar
      window.prompt('Copy this URL:', url);
    }
  }

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-diamond" />
        COOLDOWN<span className="slash">//</span>PLANNER
      </div>
      <div className="header-right">
        <button className="header-btn" type="button" onClick={newPlan} title="Start a fresh plan">+ NEW</button>
        <button className="header-btn" type="button">+ IMPORT PARTY</button>
        {slug && (
          <button
            className={`header-btn header-btn-share${copied ? ' is-copied' : ''}`}
            type="button"
            onClick={copyLink}
            title={`Copy /p/${slug} to clipboard`}
          >
            {copied ? '✓ COPIED' : `⟁ /p/${slug}`}
          </button>
        )}
        <div className={`header-save save-${saveStatus}`}>{pillLabel}</div>
        <div className="header-tag">S9.NET</div>
        <div className="header-tag">V0.1</div>
      </div>
    </header>
  );
}
