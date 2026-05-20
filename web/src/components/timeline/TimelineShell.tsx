import { useEffect, useRef } from 'react';
import type { MechCategory } from '../../types';
import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';
import { TimelineAxis } from './TimelineAxis';
import { BossLanesLeft, BossLanesRight } from './BossLanes';
import { PlayerGroupsLeft, PlayerGroupsRight } from './PlayerGroups';

/**
 * Eye-toggle pill : click flips the category's visibility on the
 * boss lanes. Hidden mechs still exist in plan data and still count
 * for coverage — this is pure render-time filtering.
 */
function VisibilityToggle({ category, label, titleShow, titleHide }: {
  category: MechCategory;
  label: string;
  titleShow: string;
  titleHide: string;
}) {
  const hidden = usePlanStore((s) => s.hiddenMechCategories.includes(category));
  const toggle = usePlanStore((s) => s.toggleMechCategoryVisibility);
  return (
    <button
      type="button"
      className={`tl-btn tl-vis ${hidden ? 'off' : 'on'} c-${category}`}
      onClick={() => toggle(category)}
      title={hidden ? titleShow : titleHide}
    >
      <span className="tl-vis-dot">{hidden ? '○' : '●'}</span>
      {label}
    </button>
  );
}

/** Base pixels-per-second at zoom 1.0. The default zoom is 2× so the
 *  initial canvas fits ~5 min of action in a 1600px viewport. */
const BASE_PX_PER_SEC = 2.667;
const ZOOM_STEP = 0.15;

/**
 * Section 02 main grid. C.1 ships:
 *   - Toolbar (buttons still wireless — they'll get handlers in C.2/C.4)
 *   - 2-col grid: 230px labels + scrollable canvas (min 1600px)
 *   - Axis row with major/minor ticks
 *   - BOSS A lane (single by default; user can add more)
 *   - Empty space below boss lanes (player groups land in C.4)
 *   - Static legend
 *
 * Mechanics, drag/drop, cd-use rendering, coverage% — all later phases.
 */
export function TimelineShell() {
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const addBossLane = usePlanStore((s) => s.addBossLane);
  const resetEncounter = usePlanStore((s) => s.resetEncounter);
  const openModal = usePlanStore((s) => s.openMechanicModal);
  const firstLaneId = usePlanStore((s) => s.bossLanes[0]?.id ?? 'lane-1');
  const zoom = usePlanStore((s) => s.zoom);
  // setZoom is read from usePlanStore.getState() inside the wheel
  // handler (which needs the latest store-reading function), not via
  // a hook subscription — the handler re-installs on mount only.

  const party = usePlanStore((s) => s.party);
  const t = useT();

  const quickAdd = (variant: 'raidwide' | 'tankbuster' | 'autos' | 'placement') => {
    const t = Math.round(fightDuration / 2);
    const allIds = party.map((p) => p.id);
    const tankId = party.find((p) => p.badge === 'MT' || p.badge === 'OT')?.id;
    const tankTargets = tankId ? [tankId] : [];
    switch (variant) {
      case 'raidwide':
        return openModal(firstLaneId, t, { targets: allIds, damage_kind: 'magical' });
      case 'tankbuster':
        return openModal(firstLaneId, t, { targets: tankTargets, damage_kind: 'magical' });
      case 'autos':
        return openModal(firstLaneId, t, { targets: tankTargets, damage_kind: 'physical' });
      case 'placement':
        return openModal(firstLaneId, t, { category: 'placement', targets: [] });
    }
  };

  const canvasWidth = Math.max(800, Math.round(fightDuration * BASE_PX_PER_SEC * zoom));

  // The right column is split into two stacked horizontal scrollers :
  //   - tl-head-scroller : axis + boss lanes (position:sticky top:0)
  //   - tl-body-scroller : player groups
  // They share the same canvas width and their scrollLeft is mirrored
  // by the syncScroll effect below. This split is mandatory because a
  // single scroller with overflow-x:auto becomes the scroll container
  // for sticky inside it, which traps the freeze behaviour.
  const rightRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Mirror scrollLeft between head and body so they always show the
  // same horizontal slice of the canvas.
  useEffect(() => {
    const head = headRef.current;
    const body = bodyRef.current;
    if (!head || !body) return;
    let syncing = false;
    const mirror = (from: HTMLDivElement, to: HTMLDivElement) => () => {
      if (syncing) return;
      syncing = true;
      to.scrollLeft = from.scrollLeft;
      requestAnimationFrame(() => {
        syncing = false;
      });
    };
    const onHead = mirror(head, body);
    const onBody = mirror(body, head);
    head.addEventListener('scroll', onHead, { passive: true });
    body.addEventListener('scroll', onBody, { passive: true });
    return () => {
      head.removeEventListener('scroll', onHead);
      body.removeEventListener('scroll', onBody);
    };
  }, []);

  // Wheel zoom anchored on the cursor: the timestamp under the mouse
  // stays under the mouse after the zoom step. React's onWheel is
  // passive by default (preventDefault is a no-op), so we attach a
  // non-passive listener manually.
  useEffect(() => {
    const outer = rightRef.current;
    if (!outer) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.preventDefault();
      const scroller = bodyRef.current;
      if (!scroller) return;
      const canvas = scroller.querySelector('.tl-canvas') as HTMLDivElement | null;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const oldWidth = canvas.offsetWidth;
      if (oldWidth <= 0) return;

      const cursorXInCanvas = e.clientX - canvasRect.left;
      const timeFraction = Math.max(0, Math.min(1, cursorXInCanvas / oldWidth));

      const state = usePlanStore.getState();
      const newZoom = Math.max(0.5, Math.min(8, state.zoom - Math.sign(e.deltaY) * ZOOM_STEP));
      if (Math.abs(newZoom - state.zoom) < 0.001) return;
      state.setZoom(newZoom);

      requestAnimationFrame(() => {
        const newCanvas = scroller.querySelector('.tl-canvas') as HTMLDivElement | null;
        if (!newCanvas) return;
        const newWidth = newCanvas.offsetWidth;
        const cursorOffsetInViewport = e.clientX - scroller.getBoundingClientRect().left;
        // Only set bodyRef ; the sync effect mirrors to headRef.
        scroller.scrollLeft = timeFraction * newWidth - cursorOffsetInViewport;
      });
    };
    outer.addEventListener('wheel', onWheel, { passive: false });
    return () => outer.removeEventListener('wheel', onWheel);
  }, []);

  // Pan-by-drag on empty boss-lane areas. The user grabs a section of
  // the boss row that doesn't have a mechanic on it and drags
  // horizontally to scroll the timeline. If the mouse moved more than
  // PAN_THRESHOLD before release we also swallow the trailing click,
  // so the AddMechanicModal doesn't open at the release position.
  useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const PAN_THRESHOLD = 4; // px

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left mouse only
      const target = e.target as HTMLElement;
      const bossRow = target.closest('.boss-row-right');
      if (!bossRow) return;
      if (target.closest('.mechanic')) return;

      const headEl = headRef.current;
      if (!headEl) return;
      const startX = e.clientX;
      const startScroll = headEl.scrollLeft;
      let moved = false;
      const prevCursor = el.style.cursor;
      el.style.cursor = 'grabbing';

      const onMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        if (!moved && Math.abs(dx) > PAN_THRESHOLD) moved = true;
        if (moved) {
          headEl.scrollLeft = startScroll - dx;
          // Sync effect mirrors to bodyRef.
          mv.preventDefault();
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        el.style.cursor = prevCursor;
        if (moved) {
          // Swallow the click that follows the drag release, so the
          // boss-row's onClick (open mech modal) doesn't fire.
          const suppress = (cl: MouseEvent) => {
            cl.stopPropagation();
            cl.preventDefault();
            document.removeEventListener('click', suppress, true);
          };
          document.addEventListener('click', suppress, true);
          // Safety net: clear the suppressor if no click follows.
          setTimeout(() => document.removeEventListener('click', suppress, true), 300);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <>
      <div className="timeline-toolbar">
        <span className="tl-tool-label">{t('tl.quickAdd')}</span>
        <button type="button" className="tl-btn raidwide"   onClick={() => quickAdd('raidwide')}>{t('tl.raidwide')}</button>
        <button type="button" className="tl-btn tankbuster" onClick={() => quickAdd('tankbuster')}>{t('tl.tankbuster')}</button>
        <button type="button" className="tl-btn autos"      onClick={() => quickAdd('autos')}>{t('tl.autos')}</button>
        <button type="button" className="tl-btn custom"     onClick={() => quickAdd('placement')}>{t('tl.placement')}</button>
        <div className="tl-divider" />
        <span className="tl-tool-label">{t('tl.lanes')}</span>
        <button type="button" className="tl-btn add-lane" onClick={addBossLane}>
          {t('tl.addLane')}
        </button>
        <button
          type="button"
          className="tl-btn reset no-plus"
          onClick={() => {
            if (window.confirm(t('tl.resetConfirm'))) resetEncounter();
          }}
        >
          {t('tl.reset')}
        </button>
        <div className="tl-divider" />
        <span className="tl-tool-label">{t('tl.view')}</span>
        <VisibilityToggle
          category="damage"
          label={t('tl.view.damage')}
          titleShow={t('tl.view.showDamage')}
          titleHide={t('tl.view.hideDamage')}
        />
        <VisibilityToggle
          category="placement"
          label={t('tl.view.placement')}
          titleShow={t('tl.view.showPlacement')}
          titleHide={t('tl.view.hidePlacement')}
        />
      </div>

      <div className="timeline-shell">
        <div className="tl-left">
          {/* The header block (axis spacer + boss lanes) sticks to the
              top of the viewport while the player groups below scroll
              past — see .tl-head sticky rule. */}
          <div className="tl-head">
            <div className="tl-axis-spacer">
              PLAYER <span className="sep" style={{ color: 'var(--text-faint)', margin: '0 6px' }}>/</span> ABILITY
            </div>
            <BossLanesLeft />
          </div>
          <PlayerGroupsLeft />
        </div>
        <div className="tl-right" ref={rightRef}>
          {/* Two stacked horizontal scrollers — head is sticky vertical,
              body is the regular scroller. scrollLeft is mirrored between
              them by the syncScroll effect above. */}
          <div className="tl-head-scroller" ref={headRef}>
            <div className="tl-canvas" style={{ minWidth: `${canvasWidth}px` }}>
              <TimelineAxis fightDuration={fightDuration} />
              <BossLanesRight />
            </div>
          </div>
          <div className="tl-body-scroller" ref={bodyRef}>
            <div className="tl-canvas" style={{ minWidth: `${canvasWidth}px` }}>
              <PlayerGroupsRight />
            </div>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--raidwide)' } as React.CSSProperties} />RAIDWIDE</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--tankbuster)' } as React.CSSProperties} />TANKBUSTER</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--autos)' } as React.CSSProperties} />AUTOS</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--custom)' } as React.CSSProperties} />CUSTOM</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--cyan)' } as React.CSSProperties} />PERSONAL</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--pink)' } as React.CSSProperties} />PARTY</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--heal)' } as React.CSSProperties} />HEAL</div>
      </div>
    </>
  );
}
