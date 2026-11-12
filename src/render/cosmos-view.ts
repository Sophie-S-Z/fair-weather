import { Container, Graphics, type Application } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { castColor, type Cast } from './cast.ts';
import { HIGH_CONTRAST_WIDTH, inkStroke } from './ink.ts';
import { bodyColor } from './line/fill.ts';
import { CREATURE_HEIGHT } from './meadow-view.ts';
import type { Palette } from './palette.ts';
import { nearestNode, SNAP_PIXELS, tieKind, type TieKind } from './ties.ts';
import { drawTimeline, type Timeline } from './timeline.ts';

/** The meadow shows through the Cosmos at this alpha (spec 11.3: a faded valley). */
const MEADOW_ALPHA = 0.25;
/** Node radius and outline, in screen pixels. */
const NODE_RADIUS = 9;
const NODE_LINE = 3;
/** The picked node's outline, thick in every mode, so its color is never the only cue. */
const PICKED_NODE_LINE = 5;
/** A picked villager's node is the warm tint villagers wear in the Meadow, deepened this far toward ink. */
const VILLAGER_DEPTH = 0.35;
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

/** The color a picked creature's node lights up in: a cast member's own, or the one all villagers share. */
export function pickedColor(id: string, cast: Map<string, Cast>, palette: Palette): number {
  const member = cast.get(id);
  return member ? castColor(member, palette) : bodyColor(palette.warmth, palette.ink, VILLAGER_DEPTH);
}

/**
 * Every friend and scar tie between creatures not away, in tie order. `warmth` is the colder
 * side's warmth. The Cosmos draws the friendships.
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

/** The timeline band the HTML lays out above the valley, in screen pixels: the strip's box and the band's bottom edge. */
export interface Band {
  strip: { x: number; y: number; w: number; h: number };
  bottom: number;
}

/**
 * The screen pixels at the top that the valley keeps clear of under the Cosmos: the band, plus the
 * most a node can stand above the scene's top edge. That is half a villager at the whole-scene
 * scale (never smaller than the scale under the band) and a picked node's radius and outline in
 * high contrast.
 */
export function valleyTop(band: Band, screenH: number, sceneH: number): number {
  const node = (NODE_RADIUS + PICKED_NODE_LINE / 2) * HIGH_CONTRAST_WIDTH;
  return band.bottom + (CREATURE_HEIGHT / 2) * (screenH / sceneH) + node;
}

export interface CosmosView {
  container: Container;
  /**
   * Draws the friendships of `lite` in screen pixels over a wash that fades the meadow, and the
   * page-colored timeline band with the strip in it (none with null).
   * `nodeAt` is the screen point of a creature's node from its scene position; `picked` is the
   * creature whose node lights up and whose friendships are drawn at full ink, or null.
   */
  update(
    lite: WorldLite,
    settings: Settings,
    nodeAt: (x: number, y: number) => [number, number],
    timeline: Timeline,
    band: Band | null,
    picked: string | null,
  ): void;
  /** The node nearest a screen point within 44 pixels, or null. */
  pick(x: number, y: number): string | null;
  setPalette(p: Palette): void;
}

/**
 * The Cosmos view (spec 11.3): the friendship network as a clean ink schematic over the faded
 * valley, with a node on each creature not away, and the thin timeline in the band the HTML keeps
 * above the valley. Every friendship is a thin line whose alpha shows its warmth; the picked
 * creature's are bold and full ink, on top, and its node lights up in its own color (a cast
 * member's full color; villagers share a deepened warm tint) with a thick
 * outline. Scars are left to the Soul view. It reads snapshots only. High contrast thickens every
 * line by half again and raises the faintest alpha; nothing here moves, so reduced motion changes
 * nothing.
 */
export function createCosmosView(
  app: Application,
  firstPalette: Palette,
  cast: Map<string, Cast>,
  threshold: number,
): CosmosView {
  let palette = firstPalette;
  const container = new Container({ label: 'cosmos' });
  const veil = new Graphics({ label: 'veil' });
  const edges = new Graphics({ label: 'edges' });
  const dots = new Graphics({ label: 'nodes' });
  // The band hides the faded valley above the scene's top edge, so no body shows behind the strip.
  const backing = new Graphics({ label: 'band' });
  const strip = new Graphics({ label: 'timeline' });
  container.addChild(veil, backing, strip, edges, dots);
  let nodes: { id: string; x: number; y: number }[] = [];

  return {
    container,
    update(lite, settings, nodeAt, timeline, band, picked) {
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
        if (n.id === picked) continue;
        dots
          .circle(n.x, n.y, NODE_RADIUS * k)
          .fill(palette.paper)
          .stroke(inkStroke(palette, NODE_LINE * k));
      }
      // The picked node goes on top.
      const lit = picked === null ? undefined : at.get(picked);
      if (lit) {
        dots
          .circle(lit.x, lit.y, NODE_RADIUS * k)
          .fill(pickedColor(lit.id, cast, palette))
          .stroke(inkStroke(palette, PICKED_NODE_LINE * k));
      }
      backing.clear();
      strip.clear();
      if (band) {
        backing.rect(0, 0, width, band.bottom).fill(palette.background);
        drawTimeline(strip, timeline, band.strip, palette, k);
      }
    },
    pick: (x, y) => nearestNode(nodes, x, y, SNAP_PIXELS),
    setPalette(p) {
      palette = p;
    },
  };
}
