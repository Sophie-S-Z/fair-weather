import { Container, Graphics, type Application } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { HIGH_CONTRAST_WIDTH, inkStroke, TUFT_ALPHA } from './ink.ts';
import type { Palette } from './palette.ts';
import { nearestNode, SNAP_PIXELS, tieKind, type TieKind } from './ties.ts';
import { drawTimeline, type Timeline } from './timeline.ts';

/** The meadow shows through the Cosmos at this alpha (spec 11.3: a faded valley). */
const MEADOW_ALPHA = 0.25;
/** Node radius and outline, in screen pixels. */
const NODE_RADIUS = 9;
const NODE_LINE = 3;
/**
 * Every friendship is one thin width; its alpha rises from the floor at the threshold by up to
 * FRIEND_ALPHA_RANGE at warmth 1, so weak ties recede. High contrast raises the floor, since a
 * faint line is low contrast (spec 11.6). The picked creature's friendships are full ink and wider.
 */
const FRIEND_WIDTH = 1.5;
const FRIEND_ALPHA_FLOOR = 0.15;
const FRIEND_ALPHA_FLOOR_HIGH_CONTRAST = 0.5;
const FRIEND_ALPHA_RANGE = 0.5;
const PICKED_WIDTH = 3;
/** The timeline strip: its share of the screen width, centered, its top, and its height, in pixels. */
const TIMELINE_SHARE = 0.5;
const TIMELINE_TOP = 12;
export const TIMELINE_HEIGHT = 24;
/** The thin page-colored backing behind the timeline reaches this far past the strip, in pixels. */
const CARD_MARGIN = 6;

/**
 * Every friend and scar tie between creatures not away, in tie order. `warmth` is the colder
 * side's warmth. The Cosmos draws the friendships; the scars are for counts (M2.13's panel).
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

export interface CosmosView {
  container: Container;
  /**
   * Draws the friendships of `lite` in screen pixels over a wash that fades the meadow, and the
   * timeline strip. `nodeAt` is the screen point of a creature's node from its scene position;
   * `picked` is the creature whose friendships are drawn at full ink, or null.
   */
  update(
    lite: WorldLite,
    settings: Settings,
    nodeAt: (x: number, y: number) => [number, number],
    timeline: Timeline,
    picked: string | null,
  ): void;
  /** The node nearest a screen point within 44 pixels, or null. */
  pick(x: number, y: number): string | null;
  setPalette(p: Palette): void;
}

/**
 * The Cosmos view (spec 11.3): the friendship network as a clean ink schematic over the faded
 * valley, with a node on each creature not away, and the thin timeline at the top. Every
 * friendship is a thin line whose alpha shows its warmth; the picked creature's are bold and full
 * ink, on top. Scars are left to the Soul view. It reads snapshots only. High contrast thickens
 * every line by half again and raises the faintest alpha; nothing here moves, so reduced motion
 * changes nothing.
 */
export function createCosmosView(app: Application, firstPalette: Palette, threshold: number): CosmosView {
  let palette = firstPalette;
  const container = new Container({ label: 'cosmos' });
  const veil = new Graphics({ label: 'veil' });
  const edges = new Graphics({ label: 'edges' });
  const dots = new Graphics({ label: 'nodes' });
  const card = new Graphics({ label: 'card' });
  const strip = new Graphics({ label: 'timeline' });
  // The timeline backing covers the edges but never a node.
  container.addChild(veil, edges, card, strip, dots);
  let nodes: { id: string; x: number; y: number }[] = [];

  return {
    container,
    update(lite, settings, nodeAt, timeline, picked) {
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
      const floor = settings.highContrast ? FRIEND_ALPHA_FLOOR_HIGH_CONTRAST : FRIEND_ALPHA_FLOOR;
      const mine: [(typeof nodes)[number], (typeof nodes)[number]][] = [];
      for (const e of cosmosEdges(lite, threshold)) {
        const a = at.get(e.a);
        const b = at.get(e.b);
        if (e.kind !== 'friend' || !a || !b) continue;
        if (e.a === picked || e.b === picked) {
          mine.push([a, b]);
          continue;
        }
        const alpha = Math.min(1, floor + (FRIEND_ALPHA_RANGE * (e.warmth - threshold)) / (1 - threshold));
        edges
          .moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .stroke(inkStroke(palette, FRIEND_WIDTH * k, alpha));
      }
      for (const [a, b] of mine) edges.moveTo(a.x, a.y).lineTo(b.x, b.y);
      if (mine.length > 0) edges.stroke(inkStroke(palette, PICKED_WIDTH * k));
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
          .stroke(inkStroke(palette, k, TUFT_ALPHA));
      } else card.clear();
    },
    pick: (x, y) => nearestNode(nodes, x, y, SNAP_PIXELS),
    setPalette(p) {
      palette = p;
    },
  };
}
