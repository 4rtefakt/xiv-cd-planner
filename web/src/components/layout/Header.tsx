import { useState } from 'react';
import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';
import { ImportPartyModal } from '../modals/ImportPartyModal';
import { ImportLogModal } from '../modals/ImportLogModal';

type CopyKind = 'edit' | 'view' | null;

export function Header() {
  const slug = usePlanStore((s) => s.slug);
  const saveStatus = usePlanStore((s) => s.saveStatus);
  const readOnly = usePlanStore((s) => s.readOnly);
  const lang = usePlanStore((s) => s.lang);
  const setLang = usePlanStore((s) => s.setLang);
  const t = useT();
  const [copied, setCopied] = useState<CopyKind>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLogOpen, setImportLogOpen] = useState(false);

  const pillLabel = (() => {
    if (readOnly) return t('save.readonly');
    switch (saveStatus) {
      case 'saving': return t('save.saving');
      case 'saved':  return t('save.saved');
      case 'error':  return t('save.error');
      default:       return t('save.idle');
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
            <button className="header-btn" type="button" onClick={newPlan} title={t('header.titleNew')}>{t('header.new')}</button>
            <button className="header-btn" type="button" onClick={() => setImportOpen(true)} title={t('header.titleImport')}>{t('header.importParty')}</button>
            <button className="header-btn" type="button" onClick={() => setImportLogOpen(true)} title={t('header.titleImportLog')}>{t('header.importLog')}</button>
          </>
        )}
        {slug && (
          <>
            <button
              className={`header-btn header-btn-share${copied === 'edit' ? ' is-copied' : ''}`}
              type="button"
              onClick={() => copy('edit')}
              title={t('header.titleCopyEdit')}
            >
              {copied === 'edit' ? t('header.copied') : t('header.copyEdit')}
            </button>
            <button
              className={`header-btn header-btn-share${copied === 'view' ? ' is-copied' : ''}`}
              type="button"
              onClick={() => copy('view')}
              title={t('header.titleCopyView')}
            >
              {copied === 'view' ? t('header.copied') : t('header.copyView')}
            </button>
          </>
        )}
        {readOnly && slug && (
          <button className="header-btn header-btn-edit" type="button" onClick={exitReadOnly} title={t('header.titleEditMode')}>
            {t('header.editMode')}
          </button>
        )}
        <div className={`header-save save-${readOnly ? 'readonly' : saveStatus}`}>{pillLabel}</div>
        <button
          className="header-lang"
          type="button"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          title={t('lang.toggle')}
        >
          <span className={lang === 'fr' ? 'on' : ''}>FR</span>
          <span className="sep">|</span>
          <span className={lang === 'en' ? 'on' : ''}>EN</span>
        </button>
        <div className="header-tag">S9.NET</div>
        <div className="header-tag">V0.1</div>
      </div>
      <ImportPartyModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ImportLogModal open={importLogOpen} onClose={() => setImportLogOpen(false)} />
    </header>
  );
}
