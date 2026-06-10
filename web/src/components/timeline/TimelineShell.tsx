import { useEffect, useRef } from 'react';
import type { MechCategory } from '../../types';
import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';
import { TimelineAxis } from './TimelineAxis';
import { BossLanesLeft, BossLanesRight } from './BossLanes';
import { PlayerGroupsLeft, PlayerGroupsRight } from './PlayerGroups';
import { PhaseLayer } from './PhaseMarkers';
import { TimelineVertical } from './TimelineVertical';
import { mainAxisPx, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX } from './metrics';

/** Compact-mode pill — shrinks every boss mech to its diamond cap. */
function CompactToggle() {
  const compact = usePlanStore((s) => s.compactMechs);
  const toggle = usePlanStore((s) => s.toggleCompactMechs);
  const t = useT();
  return (
    <button
      type="button"
      className={`tl-btn tl-vis ${compact ? 'on' : 'off'} c-compact`}
      onClick={toggle}
      title={compact ? t('tl.view.compact.off') : t('tl.view.compact.on')}
    >
      <span className="tl-vis-dot">{compact ? '◆' : '◇'}</span>
      {t('tl.view.compact')}
    </button>
  );
}

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

/** Orientation pill — flips the whole timeline between time-on-X
 *  (horizontal, default) and time-on-Y (vertical, one column per job). */
function OrientationToggle() {
  const orientation = usePlanStore((s) => s.orientation);
  const toggle = usePlanStore((s) => s.toggleOrientation);
  const t = useT();
  const vertical = orientation === 'vertical';
  return (
    <button
      type="button"
      className={`tl-btn tl-vis ${vertical ? 'on' : 'off'} c-orient`}
      onClick={toggle}
      title={vertical ? t('tl.orient.toHorizontal') : t('tl.orient.toVertical')}
    >
      <span className="tl-vis-dot">{vertical ? '↓' : '→'}</span>
      {vertical ? t('tl.orient.vertical') : t('tl.orient.horizontal')}
    </button>
  );
}

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
  const addPhase = usePlanStore((s) => s.addPhase);
  const resetEncounter = usePlanStore((s) => s.resetEncounter);
  const readOnly = usePlanStore((s) => s.readOnly);
  const orientation = usePlanStore((s) => s.orientation);
  const zoom = usePlanStore((s) => s.zoom);
  // setZoom is read from usePlanStore.getState() inside the wheel
  // handler (which needs the latest store-reading function), not via
  // a hook subscription — the handler re-installs on mount only.

  const t = useT();

  const canvasWidth = mainAxisPx(fightDuration, zoom);

  // The right column is split into two stacked horizontal scrollers :
  //   - tl-head-scroller : axis + boss lanes (position:sticky top:0)
  //   - tl-body-scroller : player groups
  // They share the same canvas width and their scrollLeft is mirrored
  // by the syncScroll effect below. This split is mandatory because a
  // single scroller with overflow-x:auto becomes the scroll container
  // for sticky inside it, which traps the freeze behaviour.
  const leftRef = useRef<HTMLDivElement>(null);
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

  // Shift+wheel anywhere on the LEFT label column should still pan the
  // timeline horizontally — the left column doesn't have a horizontal
  // scroller of its own, so without this route the user's shift+scroll
  // would just sit there doing nothing. We mirror the deltaY (which
  // the browser already converts to "horizontal intent" under shift)
  // straight onto the body scroller ; the head mirrors automatically.
  useEffect(() => {
    const left = leftRef.current;
    if (!left) return;
    const onLeftWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const body = bodyRef.current;
      if (!body) return;
      // Either axis can carry the intent depending on the OS/mouse
      // (trackpads often emit deltaX directly under shift).
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      body.scrollLeft += dx;
    };
    left.addEventListener('wheel', onLeftWheel, { passive: false });
    return () => left.removeEventListener('wheel', onLeftWheel);
  }, []);

  // Wheel zoom anchored on the cursor: the timestamp under the mouse
  // stays under the mouse after the zoom step. React's onWheel is
  // passive by default (preventDefault is a no-op), so we attach a
  // non-passive listener manually.
  useEffect(() => {
    const outer = rightRef.current;
    if (!outer) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        // Some browsers refuse to convert deltaY into horizontal scroll
        // when the host has `overflow-y: clip` (our case for both head
        // and body). Apply the pan ourselves so shift+wheel works
        // uniformly regardless of platform.
        const body = bodyRef.current;
        if (!body) return;
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        if (dx === 0) return;
        e.preventDefault();
        body.scrollLeft += dx;
        return;
      }
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
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom - Math.sign(e.deltaY) * ZOOM_STEP));
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

  // Pan-by-drag on empty areas of the timeline. The user grabs a
  // section that doesn't contain an interactive marker and drags
  // horizontally to scroll. If the mouse moved more than PAN_THRESHOLD
  // before release we also swallow the trailing click, so the modal
  // (AddMechanicModal on boss rows, click-to-place on ability rows)
  // doesn't fire at the release position.
  //
  // Pannable zones :
  //   - boss-row-right  : empty space (no `.mechanic`)
  //   - cd-row-right    : empty space (no `.cd-use`)
  useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const PAN_THRESHOLD = 4; // px

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left mouse only
      const target = e.target as HTMLElement;
      const bossRow = target.closest('.boss-row-right');
      const cdRow = target.closest('.cd-row-right');
      if (!bossRow && !cdRow) return;
      // Don't hijack mousedown on existing markers — they have their
      // own drag behaviours (mech reposition, use reposition).
      if (bossRow && target.closest('.mechanic')) return;
      if (cdRow && target.closest('.cd-use')) return;

      const headEl = headRef.current;
      if (!headEl) return;
      const startX = e.clientX;
      const startScroll = headEl.scrollLeft;
      let moved = false;
      const prevCursor = el.style.cursor;
      el.style.cursor = 'grabbing';

      const onMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        if (!moved && Math.abs(dx) > PAN_THRESHOLD) {
          moved = true;
          // Mark the column as panning so .cd-row-right / .boss-row-right
          // briefly become pointer-events:none, suppressing the React
          // mousemove handlers that would otherwise keep updating the
          // click-to-place preview while we drag.
          el.classList.add('is-panning');
          // Clear any preview already drawn from a pre-drag hover.
          usePlanStore.getState().setPreviewUse(null);
        }
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
        el.classList.remove('is-panning');
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
        <span className="tl-tool-label">{t('tl.lanes')}</span>
        <button type="button" className="tl-btn add-lane" onClick={addBossLane}>
          {t('tl.addLane')}
        </button>
        {!readOnly && (
          <button
            type="button"
            className="tl-btn add-phase"
            onClick={addPhase}
            title={t('tl.addPhase.hint')}
          >
            {t('tl.addPhase')}
          </button>
        )}
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
        <VisibilityToggle
          category="cast"
          label={t('tl.view.cast')}
          titleShow={t('tl.view.showCast')}
          titleHide={t('tl.view.hideCast')}
        />
        <CompactToggle />
        <div className="tl-divider" />
        <span className="tl-tool-label">{t('tl.orient')}</span>
        <OrientationToggle />
      </div>

      {orientation === 'vertical' ? (
        <TimelineVertical />
      ) : (
      <div className="timeline-shell orient-horizontal">
        <div className="tl-left" ref={leftRef}>
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
              {/* Labeled, interactive phase markers live on the head
                  canvas ; the body canvas mirrors the lines only. */}
              <PhaseLayer fightDuration={fightDuration} withLabels />
            </div>
          </div>
          <div className="tl-body-scroller" ref={bodyRef}>
            <div className="tl-canvas" style={{ minWidth: `${canvasWidth}px` }}>
              <PlayerGroupsRight />
              <PhaseLayer fightDuration={fightDuration} />
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="legend">
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--phys-ranged)' } as React.CSSProperties} />PHYSICAL</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--magic-ranged)' } as React.CSSProperties} />MAGICAL</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--text-faint)' } as React.CSSProperties} />PURE</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--cyan)' } as React.CSSProperties} />PLACEMENT</div>
        <div className="legend-item"><div className="legend-line" style={{ '--sw': 'var(--pink)' } as React.CSSProperties} />CAST</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--cyan)' } as React.CSSProperties} />PERSONAL</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--pink)' } as React.CSSProperties} />PARTY</div>
        <div className="legend-item"><div className="legend-swatch" style={{ '--sw': 'var(--heal)' } as React.CSSProperties} />HEAL</div>
      </div>
    </>
  );
}
