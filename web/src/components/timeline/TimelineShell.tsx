import { useEffect, useRef } from 'react';
import { usePlanStore } from '../../state/planStore';
import { TimelineAxis } from './TimelineAxis';
import { BossLanesLeft, BossLanesRight } from './BossLanes';
import { PlayerGroupsLeft, PlayerGroupsRight } from './PlayerGroups';

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

  // Wheel zoom anchored on the cursor: the timestamp under the mouse
  // stays under the mouse after the zoom step. React's onWheel is
  // passive by default (preventDefault is a no-op), so we attach a
  // non-passive listener manually.
  const rightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Plain wheel = zoom in/out. Shift+wheel keeps the native horizontal
      // scroll for users who don't want zoom.
      if (e.shiftKey) return;
      e.preventDefault();
      const canvas = el.querySelector('.tl-canvas') as HTMLDivElement | null;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const oldWidth = canvas.offsetWidth;
      if (oldWidth <= 0) return;

      // Time fraction under cursor before zoom.
      const cursorXInCanvas = e.clientX - canvasRect.left;
      const timeFraction = Math.max(0, Math.min(1, cursorXInCanvas / oldWidth));

      const state = usePlanStore.getState();
      const newZoom = Math.max(0.5, Math.min(8, state.zoom - Math.sign(e.deltaY) * ZOOM_STEP));
      if (Math.abs(newZoom - state.zoom) < 0.001) return;
      state.setZoom(newZoom);

      // After re-render, restore the cursor anchor.
      requestAnimationFrame(() => {
        const newCanvas = el.querySelector('.tl-canvas') as HTMLDivElement | null;
        if (!newCanvas) return;
        const newWidth = newCanvas.offsetWidth;
        const cursorOffsetInViewport = e.clientX - el.getBoundingClientRect().left;
        el.scrollLeft = timeFraction * newWidth - cursorOffsetInViewport;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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
      // Don't pan when the press starts on a mechanic marker — that's
      // either a click-to-remove, a drag-reposition, or a hover hit.
      if (target.closest('.mechanic')) return;

      const startX = e.clientX;
      const startScroll = el.scrollLeft;
      let moved = false;
      const prevCursor = el.style.cursor;
      el.style.cursor = 'grabbing';

      const onMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        if (!moved && Math.abs(dx) > PAN_THRESHOLD) moved = true;
        if (moved) {
          el.scrollLeft = startScroll - dx;
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
        <span className="tl-tool-label">QUICK-ADD MECH</span>
        <button type="button" className="tl-btn raidwide"   onClick={() => quickAdd('raidwide')}>RAIDWIDE</button>
        <button type="button" className="tl-btn tankbuster" onClick={() => quickAdd('tankbuster')}>TANKBUSTER</button>
        <button type="button" className="tl-btn autos"      onClick={() => quickAdd('autos')}>AUTOS</button>
        <button type="button" className="tl-btn custom"     onClick={() => quickAdd('placement')}>PLACEMENT</button>
        <div className="tl-divider" />
        <span className="tl-tool-label">LANES</span>
        <button type="button" className="tl-btn add-lane" onClick={addBossLane}>
          ADD BOSS LANE
        </button>
        <button
          type="button"
          className="tl-btn reset no-plus"
          onClick={() => {
            if (window.confirm('Reset all mechanics and assignments?')) resetEncounter();
          }}
        >
          ◆ RESET
        </button>
      </div>

      <div className="timeline-shell">
        <div className="tl-left">
          <div className="tl-axis-spacer">
            PLAYER <span className="sep" style={{ color: 'var(--text-faint)', margin: '0 6px' }}>/</span> ABILITY
          </div>
          <BossLanesLeft />
          <PlayerGroupsLeft />
        </div>
        <div className="tl-right" ref={rightRef}>
          <div className="tl-canvas" style={{ minWidth: `${canvasWidth}px` }}>
            <TimelineAxis fightDuration={fightDuration} />
            <BossLanesRight />
            <PlayerGroupsRight />
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
