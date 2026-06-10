/**
 * Shared timeline sizing constants — imported by both the horizontal
 * (TimelineShell) and vertical (TimelineVertical) scaffolds so the two
 * orientations zoom and scale identically.
 */

/** Base pixels-per-second at zoom 1.0. The default zoom is 2× so the
 *  initial canvas fits ~5 min of action in a ~1600px main axis. */
export const BASE_PX_PER_SEC = 2.667;

/** Wheel-zoom step (added/removed per notch). */
export const ZOOM_STEP = 0.15;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;

/** Length of the time (main) axis in pixels for a given fight + zoom.
 *  This is the canvas WIDTH in horizontal and the canvas HEIGHT in
 *  vertical. Floored at 800px so very short pulls still fill the view. */
export function mainAxisPx(fightDuration: number, zoom: number): number {
  return Math.max(800, Math.round(fightDuration * BASE_PX_PER_SEC * zoom));
}
