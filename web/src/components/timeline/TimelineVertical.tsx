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

  return (
    <div className="timeline-shell orient-vertical">
      <div className="tl-vert" ref={scrollRef}>
        <div className="tl-vert-corner">
          PLAYER <span className="sep" style={{ color: 'var(--text-faint)', margin: '0 6px' }}>/</span> ABILITY
        </div>
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
