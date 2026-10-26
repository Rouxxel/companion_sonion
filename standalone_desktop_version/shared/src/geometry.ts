/**
 * Pure window geometry for companions (no Electron import, so it can be unit-tested).
 * Positions are stored relative (0–1) to the work area of the display the companion is on.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  bounds: Rect;
  workArea: Rect;
}

/** What a companion remembers about its display: the id plus the display's bounds at that time. */
export interface SavedDisplay extends Rect {
  id: number;
}

export function saveDisplay(display: DisplayInfo): SavedDisplay {
  return { id: display.id, ...display.bounds };
}

/** Window size for a companion: `size` is the longer side; the aspect ratio (width / height) shapes the other one. */
export function companionDimensions(size: number, aspectRatio?: number): Size {
  if (aspectRatio && aspectRatio > 0 && Number.isFinite(aspectRatio)) {
    if (aspectRatio >= 1) return { width: size, height: Math.round(size / aspectRatio) };
    return { width: Math.round(size * aspectRatio), height: size };
  }
  return { width: size, height: size };
}

/** Pixel bounds for a relative position inside a work area. */
export function boundsInWorkArea(position: { x: number; y: number }, size: Size, workArea: Rect): Rect {
  return {
    x: Math.round(workArea.x + position.x * Math.max(0, workArea.width - size.width)),
    y: Math.round(workArea.y + position.y * Math.max(0, workArea.height - size.height)),
    width: size.width,
    height: size.height
  };
}

/** Relative position (0–1) of window bounds inside a work area; inverse of boundsInWorkArea. */
export function normalizedPosition(bounds: Rect, workArea: Rect): { x: number; y: number } {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  return {
    x: clamp((bounds.x - workArea.x) / Math.max(1, workArea.width - bounds.width)),
    y: clamp((bounds.y - workArea.y) / Math.max(1, workArea.height - bounds.height))
  };
}

function contains(rect: Rect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

function sameBounds(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Display a companion should be placed on:
 * 1. the saved display, if a display with the same id and bounds is connected;
 * 2. otherwise the display containing the center of the saved display's bounds
 *    (ids can change after docking or driver updates while the layout stays the same);
 * 3. otherwise the fallback (primary display, or the window's current display).
 */
export function pickDisplay(saved: SavedDisplay | undefined, displays: readonly DisplayInfo[], fallback: DisplayInfo): DisplayInfo {
  if (!saved) return fallback;
  const exact = displays.find((display) => display.id === saved.id && sameBounds(display.bounds, saved));
  if (exact) return exact;
  const center = { x: saved.x + saved.width / 2, y: saved.y + saved.height / 2 };
  return displays.find((display) => contains(display.bounds, center)) ?? fallback;
}
