/**
 * AbilityTooltipHost — wraps arbitrary children in a hover trigger
 * that pops a rich in-game-style tooltip. The tooltip uses a portal so
 * it can escape any clipped scroll container (player groups have
 * overflow:auto, but the tooltip needs to bleed outside).
 *
 * Anatomy of the popup, mimicking the FFXIV in-game / Garland Tools
 * style :
 *   - Header :  icon + name + "Aptitude" / "Spell" subtitle
 *   - Stats  :  recast, effect, mit potency + kind
 *   - Body   :  in-game description (FR or EN)
 *   - Extra  :  max charges, shares recast with
 *   - Footer :  level_unlocked + affinity jobs
 *
 * Show on mouseenter (200ms delay), hide on mouseleave. Tracks the host
 * element's bounding rect to anchor the popup ; chooses left/right
 * placement to keep the popup on screen.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Ability } from '../types';
import { AbilityIcon } from './Icon';
import { abilityName, useT } from '../i18n';
import { usePlanStore } from '../state/planStore';

interface Props {
  ability: Ability;
  children: React.ReactNode;
  className?: string;
  /** When true, the wrapped element receives no event handlers — the
   *  tooltip is suppressed (used during drags so the tooltip doesn't
   *  flash mid-drop). */
  disabled?: boolean;
}

const SHOW_DELAY_MS = 250;

export function AbilityTooltipHost({ ability, children, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const showTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
    };
  }, []);

  function scheduleShow() {
    if (disabled) return;
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      // The host span uses `display: contents` so it has no box —
      // getBoundingClientRect would return 0×0. Anchor on the first
      // rendered child instead (the actual ability row).
      const child = hostRef.current?.firstElementChild;
      if (child) setAnchor(child.getBoundingClientRect());
      else if (hostRef.current) setAnchor(hostRef.current.getBoundingClientRect());
      setOpen(true);
    }, SHOW_DELAY_MS);
  }
  function cancelShow() {
    if (showTimer.current) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setOpen(false);
  }

  return (
    <>
      <span
        ref={hostRef}
        className={`ab-tt-host ${className ?? ''}`}
        onMouseEnter={scheduleShow}
        onMouseLeave={cancelShow}
        // Also kill the tooltip when the user starts a drag — the
        // browser fires mouseleave too late on some platforms.
        onMouseDown={cancelShow}
        onDragStart={cancelShow}
      >
        {children}
      </span>
      {open && anchor && <AbilityTooltipPopup ability={ability} anchor={anchor} />}
    </>
  );
}

interface PopupProps {
  ability: Ability;
  anchor: DOMRect;
}

function AbilityTooltipPopup({ ability, anchor }: PopupProps) {
  const t = useT();
  const lang = usePlanStore((s) => s.lang);
  const name = abilityName(ability, lang);
  const desc = lang === 'fr' ? ability.description_fr ?? ability.description : ability.description;

  // Position : prefer the right side of the anchor ; flip to the left if
  // we'd overflow the viewport. The vertical clamp uses the tooltip's
  // measured height (long descriptions can run 400px+, so the previous
  // hardcoded 220 was letting them spill off the bottom).
  const W = 320;
  const margin = 8;
  const willOverflowRight = anchor.right + margin + W > window.innerWidth;
  const left = willOverflowRight
    ? Math.max(margin, anchor.left - W - margin)
    : anchor.right + margin;

  const popupRef = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState<number>(() =>
    Math.max(margin, anchor.top - 4),
  );

  useLayoutEffect(() => {
    const h = popupRef.current?.offsetHeight ?? 0;
    const maxTop = window.innerHeight - h - margin;
    const desired = anchor.top - 4;
    setTop(Math.max(margin, Math.min(maxTop, desired)));
  }, [anchor.top, ability.id]);

  const mitTypeLabel = (() => {
    if (lang === 'fr') {
      return ability.mit_type === 'personal' ? 'PERSONNEL'
        : ability.mit_type === 'party' ? 'ÉQUIPE' : 'SOIN';
    }
    return ability.mit_type.toUpperCase();
  })();
  const mitKindLabel = ability.mit_kind && ability.mit_kind !== 'all'
    ? (lang === 'fr'
      ? (ability.mit_kind === 'physical' ? ' · phys. uniquement' : ' · mag. uniquement')
      : ` · ${ability.mit_kind} only`)
    : '';

  return createPortal(
    <div
      ref={popupRef}
      className={`ab-tt mit-${ability.mit_type}`}
      style={{ left, top, width: W }}
      role="tooltip"
    >
      <div className="ab-tt-head">
        <div className="ab-tt-icon">
          <AbilityIcon src={ability.icon} fallbackGlyph={ability.icon_glyph} alt={name} />
        </div>
        <div className="ab-tt-title-block">
          <div className="ab-tt-name">{name}</div>
          <div className="ab-tt-subtitle">{mitTypeLabel}{mitKindLabel}</div>
        </div>
      </div>

      <div className="ab-tt-stats">
        <span className="ab-tt-stat">
          <span className="ab-tt-stat-key">{lang === 'fr' ? 'Récupé' : 'Recast'}</span>
          <span className="ab-tt-stat-val">{ability.recast}s</span>
        </span>
        <span className="ab-tt-stat">
          <span className="ab-tt-stat-key">{lang === 'fr' ? 'Durée' : 'Effect'}</span>
          <span className="ab-tt-stat-val">{ability.effect}s</span>
        </span>
        <span className="ab-tt-stat">
          <span className="ab-tt-stat-key">{lang === 'fr' ? 'Mit' : 'Mit'}</span>
          <span className="ab-tt-stat-val">{ability.mit_potency}%</span>
        </span>
      </div>

      {desc && <div className="ab-tt-desc">{desc}</div>}

      {ability.max_charges && ability.max_charges > 1 && (
        <div className="ab-tt-extra ab-tt-charges">
          {lang === 'fr' ? 'Charges max' : 'Maximum Charges'} : <strong>{ability.max_charges}</strong>
        </div>
      )}

      {ability.shares_recast_with && ability.shares_recast_with.length > 0 && (
        <div className="ab-tt-extra">
          {lang === 'fr' ? 'Récupé partagée avec' : 'Shares a recast timer with'}{' '}
          <span className="ab-tt-share-link">
            {ability.shares_recast_with.join(', ')}
          </span>
        </div>
      )}

      <div className="ab-tt-foot">
        <span className="ab-tt-foot-stat">
          {lang === 'fr' ? 'Niv' : 'Lv'} {ability.level_unlocked}
        </span>
        {(() => {
          const aff = lang === 'fr' ? ability.affinity_fr ?? ability.affinity : ability.affinity;
          return aff ? <span className="ab-tt-affinity">{aff}</span> : null;
        })()}
        <span className="ab-tt-foot-hint">{t('ability.hiddenHint')}</span>
      </div>
    </div>,
    document.body,
  );
}
