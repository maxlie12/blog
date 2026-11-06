/**
 * How the 3D camera frames an area of the farm. An area is a rectangle in screen units (the
 * orthographic camera's units); `aspect` is the canvas width over its height. Zoom 1 is the
 * default framing; zooming in shows less, and the camera may then pan to the area's edges.
 *
 * On a narrow screen the game's bars and cards cover the top and bottom of the canvas (`Cover`,
 * as shares of its height), so the area is framed in the part left open between them.
 */
export interface Frame {
  width: number;
  height: number;
  /** On a narrow screen, the share of the width shown at zoom 1 (0.7 when not given). */
  phone?: number;
}

export interface Cover {
  top: number;
  bottom: number;
}

export const NO_COVER: Cover = { top: 0, bottom: 0 };
export const ZOOM_MAX = 2.6;

/** A screen narrower than it is tall (a phone held upright). */
export function isNarrow(aspect: number): boolean {
  return aspect < 0.95;
}

/** The share of the screen height left open. */
function open(cover: Cover): number {
  return Math.max(0.3, 1 - cover.top - cover.bottom);
}

/** The height that fits the whole area in the open part of the screen. */
function fitHeight(frame: Frame, aspect: number, cover: Cover): number {
  return Math.max(frame.height / open(cover), frame.width / aspect);
}

/**
 * The screen height shown at zoom 1. A wide screen fits the whole area. A narrow (phone)
 * screen no longer has to fit the full width, so the area shows closer: its `phone` share of the
 * width, and never less than 85% of its height in the open part. The rest is a sideways drag away.
 */
export function defaultHeight(frame: Frame, aspect: number, cover: Cover = NO_COVER): number {
  const fit = fitHeight(frame, aspect, cover);
  if (!isNarrow(aspect)) return fit;
  return Math.min(fit, Math.max((frame.height * 0.85) / open(cover), (frame.width * (frame.phone ?? 0.7)) / aspect));
}

/** The furthest zoom out: a little more than the whole area. */
export function zoomMin(frame: Frame, aspect: number, cover: Cover = NO_COVER): number {
  return (defaultHeight(frame, aspect, cover) / fitHeight(frame, aspect, cover)) * 0.85;
}

export function clampZoom(zoom: number, frame: Frame, aspect: number, cover: Cover = NO_COVER): number {
  return Math.min(ZOOM_MAX, Math.max(zoomMin(frame, aspect, cover), zoom));
}

/**
 * How far the middle of the open part may move from the area's centre, along screen right and
 * screen up, so the open part never shows past the area's edges (unless the area is smaller).
 */
export function panLimits(frame: Frame, aspect: number, zoom: number, cover: Cover = NO_COVER): { x: number; y: number } {
  const height = defaultHeight(frame, aspect, cover) / zoom;
  const width = height * aspect;
  return { x: Math.max(0, (frame.width - width) / 2), y: Math.max(0, (frame.height - height * open(cover)) / 2) };
}

/** How far above the screen's middle the middle of the open part sits, for a screen `height` tall. */
export function coverLift(height: number, cover: Cover): number {
  return ((cover.bottom - cover.top) / 2) * height;
}
