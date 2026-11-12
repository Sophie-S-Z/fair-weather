import { Container, Graphics, type Application } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { dashedLine, HIGH_CONTRAST_WIDTH, inkStroke, TUFT_ALPHA } from './ink.ts';
import type { Palette } from './palette.ts';
import { drawTimeline, type Timeline } from './timeline.ts';

/** The meadow shows through the Cosmos at this alpha (spec 11.3: a faded valley). */
const MEADOW_ALPHA = 0.25;
/** A pick snaps to the nearest node within this many screen pixels, so a finger works (spec 12.4). */
export const SNAP_PIXELS = 44;
/**
 * Node radius and outline, in screen pixels. A friend's line is EDGE_WIDTH wide plus EDGE_WARMTH
 * times its warmth; a scar is dashed and SCAR_WIDTH wide. Thin, so a full village stays legible.
 */
const NODE_RADIUS = 9;
const NODE_LINE = 3;
const EDGE_WIDTH = 1;
const EDGE_WARMTH = 2;
const SCAR_WIDTH = 1.5;
const SCAR_DASH = 10;
const SCAR_GAP = 8;
/** The timeline strip: its share of the screen width, centered, its top, and its height, in pixels. */
const TIMELINE_SHARE = 0.5;
const TIMELINE_TOP = 52;
const TIMELINE_HEIGHT = 40;
/** The page-colored card behind the timeline reaches this far past the strip, in pixels. */
const CARD_MARGIN = 10;

export type TieKind = 'friend' | 'scar';

/** A friend when both warmths are above `threshold`, a scar when either is below 0, else null. */
export function tieKind(ab: number, ba: number, threshold: number): TieKind | null {
  if (ab > threshold && ba > threshold) return 'friend';
  return ab < 0 || ba < 0 ? 'scar' : null;
}

/**
 * The Cosmos network: every friend and scar tie between creatures not away, in tie order.
 * `warmth` is the colder side's warmth.
 */
export function cosmosEdges(
  lite: WorldLite,
  threshold: number,
): { a: string; b: string; kind: TieKind; warmth: number }[] {
  const away = new Set(lite.creatures.filter((c) => c.state === 'away').map((c) => c.id));
  const out: { a: string; b: string; kind: TieKind; warmth: number }[] = [];
  for (const t of lite.ties) {
    const kind = tieKind(t.ab, t.ba, threshold);
    if (kind && !away.has(t.a) && !away.has(t.b))
      out.push({ a: t.a, b: t.b, kind, warmth: Math.min(t.ab, t.ba) });
  }
  return out;
}

/** The id of the node nearest (x, y) within `radius`, or null. */
export function nearestNode(
  nodes: readonly { id: string; x: number; y: number }[],
  x: number,
  y: number,
  radius: number,
): string | null {
  let best: string | null = null;
  let bestD = radius;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

export interface CosmosView {
  container: Container;
  /**
   * Draws the network of `lite` in screen pixels over a wash that fades the meadow, and the
   * timeline strip. `nodeAt` is the screen point of a creature's node from its scene position.
   */
  update(
    lite: WorldLite,
    settings: Settings,
    nodeAt: (x: number, y: number) => [number, number],
    timeline: Timeline,
  ): void;
  /** The node nearest a screen point within 44 pixels, or null. */
  pick(x: number, y: number): string | null;
  setPalette(p: Palette): void;
}

/**
 * The Cosmos view (spec 11.3): the friendship network as a clean ink schematic over the faded
 * valley, with a node on each creature not away, and the timeline on a small card above. Friends
 * are solid lines, bolder the warmer the colder side; scars are dashed, so the two differ in shape
 * as well as weight (spec 11.6). It reads snapshots only. High contrast thickens every line by
 * half again; nothing here moves, so reduced motion changes nothing.
 */
export function createCosmosView(app: Application, firstPalette: Palette, threshold: number): CosmosView {
  let palette = firstPalette;
  const container = new Container({ label: 'cosmos' });
  const veil = new Graphics({ label: 'veil' });
  const edges = new Graphics({ label: 'edges' });
  const dots = new Graphics({ label: 'nodes' });
  const card = new Graphics({ label: 'card' });
  const strip = new Graphics({ label: 'timeline' });
  // The timeline card covers the edges but never a node.
  container.addChild(veil, edges, card, strip, dots);
  let nodes: { id: string; x: number; y: number }[] = [];

  return {
    container,
    update(lite, settings, nodeAt, timeline) {
      const k = settings.highContrast ? HIGH_CONTRAST_WIDTH : 1;
      const { width, height } = app.screen;
      veil
        .clear()
        .rect(0, 0, width, height)
        .fill({ color: palette.background, alpha: 1 - MEADOW_ALPHA });
      nodes = lite.creatures
        .filter((c) => c.state !== 'away')
        .map((c) => {
          const [x, y] = nodeAt(c.x, c.y);
          return { id: c.id, x, y };
        });
      const at = new Map(nodes.map((n) => [n.id, n]));
      edges.clear();
      dots.clear();
      for (const e of cosmosEdges(lite, threshold)) {
        const a = at.get(e.a);
        const b = at.get(e.b);
        if (!a || !b) continue;
        if (e.kind === 'friend') {
          edges
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke(inkStroke(palette, (EDGE_WIDTH + EDGE_WARMTH * e.warmth) * k));
        } else {
          dashedLine(edges, a.x, a.y, b.x, b.y, SCAR_DASH, SCAR_GAP).stroke(
            inkStroke(palette, SCAR_WIDTH * k),
          );
        }
      }
      for (const n of nodes) {
        dots
          .circle(n.x, n.y, NODE_RADIUS * k)
          .fill(palette.paper)
          .stroke(inkStroke(palette, NODE_LINE * k));
      }
      const box = {
        x: (width * (1 - TIMELINE_SHARE)) / 2,
        y: TIMELINE_TOP,
        w: width * TIMELINE_SHARE,
        h: TIMELINE_HEIGHT,
      };
      drawTimeline(strip, timeline, box, palette, k);
      if (timeline.points.length >= 2) {
        const m = CARD_MARGIN;
        card
          .clear()
          .roundRect(box.x - m, box.y - m, box.w + 2 * m, box.h + 2 * m, m)
          .fill(palette.background)
          .stroke(inkStroke(palette, NODE_LINE * k * 0.5, TUFT_ALPHA));
      } else card.clear();
    },
    pick: (x, y) => nearestNode(nodes, x, y, SNAP_PIXELS),
    setPalette(p) {
      palette = p;
    },
  };
}
