import { useEffect, useRef } from 'react';
import { usePlanStore } from '../../state/planStore';
import { TimelineAxis } from './TimelineAxis';
import { BossLanesLeft, BossLanesRight } from './BossLanes';
import { PlayerGroupsLeft, PlayerGroupsRight } from './PlayerGroups';
import { PhaseLayer } from './PhaseMarkers';
import { mainAxisPx, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX } from './metrics';

/**
 * Vertical timeline scaffold — a real re-layout (time = Y), NOT a CSS
 * rotation. It reuses the very same child components as the horizontal
 * shell (the markers are orientation-aware via lib/orientation), arranged
 * in a frozen-pane grid :
 *
 *   ┌──────────┬───────────────────────────┐
 *   │ corner   │ column headers (sticky top)│   ← BossLanesLeft + PlayerGroupsLeft
 *   ├──────────┼───────────────────────────┤
 *   │ time     │ canvas columns            │
 *   │ ruler    │  (boss lanes + abilities) │   ← BossLanesRight + PlayerGroupsRight
 *   │ (sticky  │  markers placed by top/   │
 *   │  left)   │  height = time            │
 *   └──────────┴───────────────────────────┘
 *
 * The label band (left components) and the canvas (right components)
 * iterate the same data in the same order ; fixed per-column widths
 * (CSS vars in components.css) keep each header aligned over its column.
 * The whole thing lives in ONE scroll container, so sticky handles both
 * frozen panes natively — no scrollLeft mirroring like the horizontal
 * shell needs.
 */
export function TimelineVertical() {
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const zoom = usePlanStore((s) => s.zoom);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Main-axis length in px (here a HEIGHT). Drives the ruler + canvas so
  // the time scale matches the horizontal shell at the same zoom.
  const canvasHeight = mainAxisPx(fightDuration, zoom);

  // Ctrl/Cmd + wheel zooms, anchored on the cursor's timestamp (the time
  // under the pointer stays under the pointer). Plain wheel scrolls time
  // natively (vertical) ; shift+wheel scrolls across columns — both are
  // the browser's default for an overflow:auto box, so we only intercept
  // the zoom gesture.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // let native scroll handle the rest
      e.preventDefault();
      const canvas = scroller.querySelector('.tl-vert-canvas') as HTMLDivElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const oldH = canvas.offsetHeight;
      if (oldH <= 0) return;
      const cursorYInCanvas = e.clientY - rect.top;
      const timeFraction = Math.max(0, Math.min(1, cursorYInCanvas / oldH));

      const state = usePlanStore.getState();
      const newZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, state.zoom - Math.sign(e.deltaY) * ZOOM_STEP),
      );
      if (Math.abs(newZoom - state.zoom) < 0.001) return;
      state.setZoom(newZoom);

      requestAnimationFrame(() => {
        const newCanvas = scroller.querySelector('.tl-vert-canvas') as HTMLDivElement | null;
        if (!newCanvas) return;
        const newH = newCanvas.offsetHeight;
        const cursorOffsetInViewport = e.clientY - scroller.getBoundingClientRect().top;
        scroller.scrollTop = timeFraction * newH - cursorOffsetInViewport;
      });
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  // Pan-by-drag on empty canvas zones — grab anywhere that isn't an
  // interactive marker and drag to scroll in BOTH axes (time = Y,
  // columns = X). Mirrors the horizontal shell's pan, but 2-D. If the
  // mouse moved past the threshold we swallow the trailing click so a
  // drag doesn't also place a cooldown / open the mech modal.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const PAN_THRESHOLD = 4; // px
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.tl-vert-canvas')) return; // canvas only
      // Leave the markers' own drag/click behaviours alone.
      if (target.closest('.mechanic') || target.closest('.cd-use') || target.closest('.phase-label')) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = el.scrollLeft;
      const startTop = el.scrollTop;
      let moved = false;
      const prevCursor = el.style.cursor;

      const onMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > PAN_THRESHOLD) {
          moved = true;
          el.classList.add('is-panning');
          el.style.cursor = 'grabbing';
          usePlanStore.getState().setPreviewUse(null);
        }
        if (moved) {
          el.scrollLeft = startLeft - dx;
          el.scrollTop = startTop - dy;
          mv.preventDefault();
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        el.style.cursor = prevCursor;
        el.classList.remove('is-panning');
        if (moved) {
          const suppress = (cl: MouseEvent) => {
            cl.stopPropagation();
            cl.preventDefault();
            document.removeEventListener('click', suppress, true);
          };
          document.addEventListener('click', suppress, true);
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
    <div className="timeline-shell orient-vertical">
      <div className="tl-vert" ref={scrollRef}>
        {/* Empty frozen corner (over the ruler × headers intersection). */}
        <div className="tl-vert-corner" aria-hidden />
        <div className="tl-vert-colhead">
          <BossLanesLeft />
          <PlayerGroupsLeft />
        </div>
        <div className="tl-vert-ruler" style={{ height: `${canvasHeight}px` }}>
          <TimelineAxis fightDuration={fightDuration} />
        </div>
        <div className="tl-vert-canvas" style={{ height: `${canvasHeight}px` }}>
          <BossLanesRight />
          <PlayerGroupsRight />
          <PhaseLayer fightDuration={fightDuration} withLabels />
        </div>
      </div>
    </div>
  );
}
