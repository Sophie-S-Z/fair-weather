import { Container, Graphics, Text } from 'pixi.js';
import { CAST } from '../toy/cast.ts';
import { behindWall, depthScale, FLOOR, heightOf, TABLE_H, TABLE_W } from '../toy/geometry.ts';
import type { Critter, Table } from '../toy/types.ts';
import { drawBubble, drawIcon, ICON_Y } from './bubbles.ts';
import { HIGH_CONTRAST_WIDTH, dashedLine, smoothClosed, TUFT_ALPHA } from './ink.ts';
import { bodyColor } from './line/fill.ts';
import { createLineView } from './line/line-view.ts';
import type { Rig } from './line/rig.ts';
import { PALETTE } from './palette.ts';
import { drawFlat, drawStanding, SCREEN } from './props.ts';

export interface Look {
  reducedMotion: boolean;
  highContrast: boolean;
}

/** A part of the table to show, in table units. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_TABLE: Rect = { x: 0, y: 0, w: TABLE_W, h: TABLE_H };

/** Seconds a new bubble takes to pop to full size. */
const POP = 0.18;
/** How high a hop lifts a creature, in table units at depth 1. */
const HOP_HEIGHT = 20;
/** How high the player lifts a held creature. */
const LIFT = 34;
/** Shadows on the lamp's screen are this much larger than their makers. */
const SHADOW_GROW = 1.25;
/** The entrance: each creature drops onto a new table, one after the other. */
const ENTER_DELAY = 0.2;
const ENTER_STAGGER = 0.07;
const ENTER_SECONDS = 0.6;
const ENTER_HEIGHT = 620;

/** How far above its spot a creature still is during the entrance: a drop with two small bounces. */
export function entranceOffset(time: number, index: number): number {
  const e = (time - ENTER_DELAY - index * ENTER_STAGGER) / ENTER_SECONDS;
  if (e >= 1) return 0;
  if (e <= 0) return ENTER_HEIGHT;
  const bounce =
    e < 0.6
      ? 1 - (e / 0.6) ** 2
      : e < 0.85
        ? 0.12 * Math.sin(((e - 0.6) / 0.25) * Math.PI)
        : 0.03 * Math.sin(((e - 0.85) / 0.15) * Math.PI);
  return ENTER_HEIGHT * bounce;
}

interface CritterView {
  wrap: Container;
  body: Container;
  line: ReturnType<typeof createLineView>;
  smudge: Graphics;
  bubble: Container;
  bubbleArt: Graphics;
  icon: Graphics;
  count: Text;
  bubbleKey: string;
  bubbleSince: number;
}

/** The grass tufts: fixed spots so the floor never shimmers. */
const TUFTS: readonly [number, number][] = Array.from({ length: 34 }, (_, k) => [
  FLOOR.left + ((k * 433) % (FLOOR.right - FLOOR.left)),
  FLOOR.top + 10 + ((k * 197) % (FLOOR.bottom - FLOOR.top)),
]);

function drawFloor(g: Graphics, look: Look): void {
  const w = look.highContrast ? 3 * HIGH_CONTRAST_WIDTH : 3;
  g.clear();
  g.rect(-400, FLOOR.top - 40, TABLE_W + 800, TABLE_H + 400).fill(PALETTE.floor);
  g.moveTo(-400, FLOOR.top - 40);
  for (let x = -400; x <= TABLE_W + 400; x += 80) g.lineTo(x, FLOOR.top - 40 + Math.sin(x * 0.013) * 5);
  g.stroke({ color: PALETTE.ink, width: w, cap: 'round', join: 'round' });
  for (const [x, y] of TUFTS) {
    g.moveTo(x - 6, y)
      .lineTo(x - 9, y - 9)
      .moveTo(x, y)
      .lineTo(x, y - 12)
      .moveTo(x + 6, y)
      .lineTo(x + 9, y - 9);
  }
  g.stroke({ color: PALETTE.ink, width: w * 0.5, alpha: TUFT_ALPHA, cap: 'round' });
}

/** Clouds in the sky strip: x, height above the horizon, size, and drift speed (units per second). */
const CLOUDS: readonly [number, number, number, number][] = [
  [180, 120, 1, 6],
  [760, 190, 0.7, 4],
  [1260, 110, 1.2, 7],
];
const CLOUD_SPAN = TABLE_W + 600;

function drawClouds(g: Graphics, time: number, look: Look): void {
  const w = look.highContrast ? 3 * HIGH_CONTRAST_WIDTH : 3;
  g.clear();
  for (const [x0, up, size, speed] of CLOUDS) {
    const drift = look.reducedMotion ? 0 : time * speed;
    const x = ((x0 + drift + 300) % CLOUD_SPAN) - 300;
    const y = FLOOR.top - 40 - up;
    const p = [-60, 0, -52, -22, -26, -34, 0, -48, 30, -36, 56, -20, 62, 0].map((v, i) =>
      i % 2 === 0 ? x + v * size : y + v * size,
    );
    smoothClosed(g, p)
      .fill(PALETTE.paper)
      .stroke({ color: PALETTE.ink, width: w * 0.8, alpha: 0.8, join: 'round' });
  }
}

export interface TableView {
  container: Container;
  /** Redraws the table. `pending` is a tie being drawn, from a creature to a point. */
  update(
    t: Table,
    seconds: number,
    look: Look,
    pending?: { from: string; x: number; y: number } | null,
  ): void;
  /**
   * Fits `rect` of the table into a `width` by `height` screen, centered, inside `top` and `bottom`
   * pixels kept clear for the page's own controls.
   */
  fit(width: number, height: number, rect?: Rect, clear?: { top: number; bottom: number }): void;
  /** Table units to screen pixels, for the HTML overlay, and back. */
  toScreen(x: number, y: number): [number, number];
  toTable(x: number, y: number): [number, number];
  scale(): number;
}

export function createTableView(rigs: ReadonlyMap<string, Rig>): TableView {
  const container = new Container();
  const world = new Container();
  container.addChild(world);
  const sky = new Graphics();
  const floor = new Graphics();
  const flat = new Graphics();
  const shadows = new Graphics();
  const ties = new Graphics();
  const depth = new Container();
  depth.sortableChildren = true;
  const bubbles = new Container();
  world.addChild(sky, floor, flat, shadows, ties, depth, bubbles);

  const views = new Map<string, CritterView>();
  const propLayers = new Map<string, Graphics>();
  let floorContrast: boolean | null = null;
  let k = 1;

  function viewFor(c: Critter): CritterView | null {
    const have = views.get(c.id);
    if (have) return have;
    const rig = rigs.get(c.cast);
    if (!rig) return null;
    const temper = CAST[c.cast];
    const line = createLineView(
      rig,
      { ink: PALETTE.ink, accent: temper.tint, paper: PALETTE.paper },
      110 * temper.scale,
    );
    const smudge = new Graphics();
    const [ex, ey] = rig.markers.eyeR;
    smudge
      .ellipse(ex * 110 * temper.scale + 4, -(ey - 0.1) * 110 * temper.scale, 7, 4)
      .fill({ color: PALETTE.ink, alpha: 0.75 });
    const body = new Container();
    body.addChild(line.container, smudge);
    const wrap = new Container();
    const shadow = new Graphics().ellipse(0, 0, 34, 8).fill({ color: PALETTE.ink, alpha: 0.12 });
    wrap.addChild(shadow, body);
    const bubble = new Container();
    const bubbleArt = new Graphics();
    const count = new Text({
      text: '',
      style: { fontFamily: 'Atkinson Hyperlegible', fontSize: 30, fontWeight: '700', fill: PALETTE.ink },
    });
    count.anchor.set(0.5);
    count.y = ICON_Y;
    const icon = new Graphics();
    icon.y = ICON_Y;
    bubble.addChild(bubbleArt, icon, count);
    bubbles.addChild(bubble);
    depth.addChild(wrap);
    const v: CritterView = {
      wrap,
      body,
      line,
      smudge,
      bubble,
      bubbleArt,
      icon,
      count,
      bubbleKey: '',
      bubbleSince: 0,
    };
    views.set(c.id, v);
    return v;
  }

  function drawCritter(
    t: Table,
    c: Critter,
    index: number,
    v: CritterView,
    seconds: number,
    look: Look,
  ): void {
    const temper = CAST[c.cast];
    const d = depthScale(c.y);
    const hop = look.reducedMotion ? 0 : Math.sin(c.hop * Math.PI) * HOP_HEIGHT * d;
    const lift = (c.held ? LIFT : 0) + (look.reducedMotion ? 0 : entranceOffset(t.time, index));
    const sink = c.stuck ? 10 : 0;
    v.wrap.position.set(c.x, c.y + sink);
    v.wrap.zIndex = c.y + (c.held ? 1000 : 0);
    const squash = Math.max(-0.35, Math.min(0.35, c.squash * 0.7));
    v.body.position.set(0, -hop - lift);
    v.body.scale.set(c.face * d * (1 + squash), d * (1 - squash));
    v.body.rotation = c.lookUp ? -0.18 * c.face : 0;
    v.smudge.visible = c.smudge;
    const fill = bodyColor(PALETTE.paper, temper.tint, 0.35 + c.mood.color * 0.35);
    v.line.update(c.mood, seconds, look.reducedMotion, 0, {
      body: fill,
      widthScale: look.highContrast ? HIGH_CONTRAST_WIDTH : 1,
    });

    const b = c.bubble;
    v.bubble.visible = b !== null;
    if (!b) return;
    const key = `${b.icon}:${String(b.n)}:${String(look.highContrast)}`;
    if (key !== v.bubbleKey) {
      if (!v.bubbleKey.startsWith(`${b.icon}:`)) v.bubbleSince = t.time;
      v.bubbleKey = key;
      drawBubble(v.bubbleArt.clear(), look.highContrast);
      drawIcon(v.icon.clear(), b.icon);
      v.count.text = b.icon === 'count' ? String(b.n) : b.n > 1 ? `×${String(b.n)}` : '';
      v.count.x = b.icon === 'count' ? 0 : 18;
      v.count.style.fontSize = b.icon === 'count' ? 30 : 16;
      v.count.y = b.icon === 'count' ? ICON_Y : ICON_Y + 14;
    }
    const pop = look.reducedMotion ? 1 : Math.min(1, (t.time - v.bubbleSince) / POP);
    v.bubble.position.set(c.x + c.face * 10, c.y + sink - heightOf(c) - hop - lift - 4);
    v.bubble.scale.set(d * (0.6 + 0.4 * pop + Math.sin(pop * Math.PI) * 0.15));
  }

  function bodyMiddle(t: Table, c: Critter, look: Look): [number, number] {
    const enter = look.reducedMotion ? 0 : entranceOffset(t.time, t.critters.indexOf(c));
    return [c.x, c.y - heightOf(c) * 0.45 - (c.held ? LIFT : 0) - enter];
  }

  return {
    container,
    update(t, seconds, look, pending) {
      if (floorContrast !== look.highContrast) {
        floorContrast = look.highContrast;
        drawFloor(floor, look);
      }
      drawClouds(sky, t.time, look);
      const width = look.highContrast ? 3 * HIGH_CONTRAST_WIDTH : 3;
      const propLook = { width, time: t.time, calm: look.reducedMotion };

      flat.clear();
      shadows.clear();
      for (const p of t.props) drawFlat(flat, p, propLook);

      const lamp = t.props.find((p) => p.kind === 'lamp' && p.on);
      if (lamp) {
        for (const c of t.critters) {
          if (!behindWall(lamp, c.x, c.y)) continue;
          const rig = rigs.get(c.cast);
          if (!rig) continue;
          const h = heightOf(c) * SHADOW_GROW;
          const hop = look.reducedMotion ? 0 : Math.sin(c.hop * Math.PI) * HOP_HEIGHT;
          const sx = lamp.x + (c.x - lamp.x) * SHADOW_GROW;
          const base = lamp.y + SCREEN.bottom - 4 - hop;
          const pts: number[] = [];
          for (let i = 0; i < rig.points.length; i += 4) {
            pts.push(sx + (rig.points[i] ?? 0) * h * c.face, base - (rig.points[i + 1] ?? 0) * h * 0.95);
          }
          shadows.poly(pts, true).fill({ color: PALETTE.ink, alpha: 0.55 });
        }
      }

      ties.clear();
      for (const e of t.ties) {
        const a = t.critters.find((c) => c.id === e.a);
        const b = t.critters.find((c) => c.id === e.b);
        if (!a || !b) continue;
        const [ax, ay] = bodyMiddle(t, a, look);
        const [bx, by] = bodyMiddle(t, b, look);
        const sag = 18 + Math.hypot(bx - ax, by - ay) * 0.12;
        ties.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
      }
      ties.stroke({ color: PALETTE.berry, width: width * 0.9, alpha: 0.85, cap: 'round' });
      if (pending) {
        const from = t.critters.find((c) => c.id === pending.from);
        if (from) {
          const [ax, ay] = bodyMiddle(t, from, look);
          dashedLine(ties, ax, ay, pending.x, pending.y, 12, 9).stroke({
            color: PALETTE.berry,
            width,
            cap: 'round',
          });
        }
      }

      const live = new Set(t.props.map((p) => p.kind));
      for (const [kind, g] of propLayers) {
        if (!live.has(kind as never)) {
          g.destroy();
          propLayers.delete(kind);
        }
      }
      for (const p of t.props) {
        let g = propLayers.get(p.kind);
        if (!g) {
          g = new Graphics();
          propLayers.set(p.kind, g);
          depth.addChild(g);
        }
        g.clear();
        drawStanding(g, p, propLook);
        g.zIndex = p.y;
      }

      const seen = new Set<string>();
      t.critters.forEach((c, i) => {
        const v = viewFor(c);
        if (!v) return;
        seen.add(c.id);
        drawCritter(t, c, i, v, seconds, look);
      });
      for (const [id, v] of views) {
        if (seen.has(id)) continue;
        v.wrap.destroy({ children: true });
        v.bubble.destroy({ children: true });
        views.delete(id);
      }
    },
    fit(width, height, rect = FULL_TABLE, clear = { top: 0, bottom: 0 }) {
      const room = Math.max(1, height - clear.top - clear.bottom);
      k = Math.min(width / rect.w, room / rect.h);
      world.scale.set(k);
      world.position.set(
        (width - rect.w * k) / 2 - rect.x * k,
        clear.top + (room - rect.h * k) / 2 - rect.y * k,
      );
    },
    toScreen(x, y) {
      return [world.position.x + x * k, world.position.y + y * k];
    },
    toTable(x, y) {
      return [(x - world.position.x) / k, (y - world.position.y) / k];
    },
    scale: () => k,
  };
}
