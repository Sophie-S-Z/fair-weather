// Pointer play: a click takes the same path as Enter; drags blow and thread; the wheel and a pinch
// zoom. `pick` is render's hit test, in the current view.
import { activeTool, EAST, HERO, threadTo, useTool, waveAt, type InputContext } from './keyboard.ts';
import type { Point } from './verbs.ts';

export type PickFn = (x: number, y: number) => { creature: string | null };

/** With blow, a press that moves this many screen pixels or more is a gust, not a click. */
const DRAG_PIXELS = 40;
/** The wheel zooms at most one step in this many milliseconds. */
const WHEEL_MS = 300;
/** Two pointers spread past this times their start distance zoom in, once per gesture. */
const PINCH_IN = 1.25;
/** Two pointers closer than this times their start distance zoom out, once per gesture. */
const PINCH_OUT = 0.8;

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export function createPointer(
  target: EventTarget,
  pick: PickFn,
  /** Screen (client) point to scene point, supplied by the caller. */
  toScene: (x: number, y: number) => Point,
  ctx: InputContext,
): () => void {
  /** The client points of the pointers now down, by pointer id. */
  const down = new Map<number, Point>();
  /** Where the one pointer of a click or drag went down; null once a second pointer joins. */
  let start: Point | null = null;
  /** A two-pointer gesture: its start distance, and whether it has zoomed. */
  let pinch: { from: number; zoomed: boolean } | null = null;
  let lastWheel = -Infinity;
  const zoomable = (): boolean => ctx.tools().includes('zoom');
  const awake = (id: string | null): id is string =>
    id !== null && ctx.creatures().some((c) => c.id === id && c.state !== 'away');

  const click = (at: Point, shift: boolean): void => {
    const scene = toScene(at.x, at.y);
    const tool = activeTool(ctx);
    if (tool === 'walk') {
      // A click on a creature waves at it; a click on the ground, or on the hero, walks there.
      const who = pick(at.x, at.y).creature;
      if (who !== null && who !== HERO) {
        ctx.select(who);
        waveAt(ctx, who);
        return;
      }
      ctx.moveCursor(scene);
    } else if (tool === 'place' || tool === 'shine' || tool === 'fog' || tool === 'blow') {
      ctx.moveCursor(scene);
    } else {
      ctx.select(pick(at.x, at.y).creature);
      // A reply, a manner, or a keepsake goes with its buttons; a click on the scene only picks.
      if (tool === 'respond' || tool === 'manner' || tool === 'keepsake') return;
    }
    useTool(ctx, scene, shift, EAST);
  };

  const release = (from: Point, to: Point, shift: boolean): void => {
    const tool = activeTool(ctx);
    if (tool === 'thread' && ctx.view() === 'cosmos') {
      const a = pick(from.x, from.y).creature;
      const b = pick(to.x, to.y).creature;
      if (a !== b) {
        if (awake(a) && awake(b)) threadTo(ctx, a, b);
        return;
      }
    }
    if (tool === 'blow' && distance(from, to) >= DRAG_PIXELS) {
      const s = toScene(from.x, from.y);
      const e = toScene(to.x, to.y);
      ctx.act({ verb: 'blow', x: s.x, y: s.y, dx: e.x - s.x, dy: e.y - s.y });
    } else {
      click(to, shift);
    }
  };

  const spread = (): number => {
    const [a, b] = [...down.values()];
    return a && b ? distance(a, b) : 0;
  };

  const onDown = (e: Event): void => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    // A primary pointer means no other is down: forget any whose up landed outside the target.
    if (p.isPrimary) down.clear();
    down.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (down.size === 1) {
      start = { x: p.clientX, y: p.clientY };
    } else {
      start = null;
      pinch = down.size === 2 ? { from: spread(), zoomed: false } : null;
    }
  };
  const onMove = (e: Event): void => {
    const p = e as PointerEvent;
    if (!down.has(p.pointerId)) return;
    down.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (!pinch || pinch.zoomed || pinch.from === 0 || !zoomable()) return;
    const k = spread() / pinch.from;
    if (k > PINCH_IN || k < PINCH_OUT) {
      pinch.zoomed = true;
      ctx.zoom(k > PINCH_IN ? 'in' : 'out');
    }
  };
  const onUp = (e: Event): void => {
    const p = e as PointerEvent;
    if (!down.delete(p.pointerId)) return;
    if (down.size < 2) pinch = null;
    const from = start;
    start = null;
    if (from) release(from, { x: p.clientX, y: p.clientY }, p.shiftKey);
  };
  const onCancel = (e: Event): void => {
    down.delete((e as PointerEvent).pointerId);
    start = null;
    if (down.size < 2) pinch = null;
  };
  const onWheel = (e: Event): void => {
    const w = e as WheelEvent;
    if (!zoomable() || w.deltaY === 0) return;
    w.preventDefault();
    if (w.timeStamp - lastWheel < WHEEL_MS) return;
    lastWheel = w.timeStamp;
    ctx.zoom(w.deltaY < 0 ? 'in' : 'out');
  };

  const listeners: [string, (e: Event) => void][] = [
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onCancel],
    ['wheel', onWheel],
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn, { passive: false });
  return () => {
    for (const [type, fn] of listeners) target.removeEventListener(type, fn);
  };
}
