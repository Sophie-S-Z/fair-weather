/** Scene to screen: `screen = scene * scale + (x, y)`. */
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

/** A camera shot: a scene point to center and a zoom over the whole-scene fit. */
export interface Shot {
  x: number;
  y: number;
  zoom: number;
}

/** Centers `focus` when the zoomed scene is larger than the screen, but never past the scene edge. */
function axis(sceneSize: number, screenSize: number, scale: number, focus: number): number {
  const half = screenSize / 2 / scale;
  const center =
    sceneSize * scale <= screenSize ? sceneSize / 2 : Math.min(Math.max(focus, half), sceneSize - half);
  return screenSize / 2 - center * scale;
}

/** Fits the whole scene inside the screen, centered; a shot zooms in on its point. */
export function viewTransform(
  sceneW: number,
  sceneH: number,
  screenW: number,
  screenH: number,
  shot?: Shot,
): ViewTransform {
  const scale = Math.min(screenW / sceneW, screenH / sceneH) * (shot?.zoom ?? 1);
  return {
    scale,
    x: axis(sceneW, screenW, scale, shot?.x ?? sceneW / 2),
    y: axis(sceneH, screenH, scale, shot?.y ?? sceneH / 2),
  };
}

/** The scene point under a screen point. */
export function toScene(t: ViewTransform, sx: number, sy: number): [number, number] {
  return [(sx - t.x) / t.scale, (sy - t.y) / t.scale];
}

/** Moves `from` toward `to` by the fraction `k`; k = 1 arrives. */
export function lerpTransform(from: ViewTransform, to: ViewTransform, k: number): ViewTransform {
  return {
    scale: from.scale + (to.scale - from.scale) * k,
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
  };
}
