import { Container, Graphics, type Application } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { creatureColor, type Cast } from './cast.ts';
import { dashedLine, HIGH_CONTRAST_WIDTH, inkStroke, TUFT_ALPHA } from './ink.ts';
import { createLineView } from './line/line-view.ts';
import type { Rig } from './line/rig.ts';
import type { Palette } from './palette.ts';
import { nearestNode, SNAP_PIXELS, tieKind } from './ties.ts';

/** The rig for a creature with none of its own. */
const FALLBACK_RIG = 'villager';
/** The constellation fills this share of the room it has. */
const FILL = 0.8;
/** Star distances as shares of the constellation radius: warmth 1 is nearest, warmth -1 farthest. */
const NEAREST = 0.45;
const FARTHEST = 1;
/** The soul's height as a share of the constellation radius. */
const SOUL_HEIGHT = 0.5;
/** Star radius, outline, and tie widths, in screen pixels. A friend's tie glows in its star's color. */
const STAR_RADIUS = 12;
const STAR_LINE = 3;
const TIE_WIDTH = 4;
const GLOW_WIDTH = 16;
const GLOW_ALPHA = 0.3;
const MET_WIDTH = 1.5;
const SCAR_DASH = 10;
const SCAR_GAP = 8;

type StarKind = 'friend' | 'scar' | 'met';

/**
 * Every creature with a tie to `id`, in id order, at angles round the soul starting at the top
 * and going clockwise. A star's distance, as a share of the constellation radius, falls as `id`'s
 * warmth toward it rises. A friend has both warmths above `threshold`, a scar has either below 0.
 */
export function soulLayout(
  lite: WorldLite,
  id: string,
  threshold: number,
): { id: string; x: number; y: number; kind: StarKind }[] {
  const met = lite.ties
    .filter((t) => t.a === id || t.b === id)
    .map((t) => ({
      id: t.a === id ? t.b : t.a,
      toward: t.a === id ? t.ab : t.ba,
      kind: tieKind(t.ab, t.ba, threshold) ?? ('met' as const),
    }))
    .sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  return met.map((m, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / met.length;
    const warmth = Math.min(1, Math.max(-1, m.toward));
    const d = NEAREST + ((FARTHEST - NEAREST) * (1 - warmth)) / 2;
    return { id: m.id, x: d * Math.cos(angle), y: d * Math.sin(angle), kind: m.kind };
  });
}

/** The screen pixels the HTML takes on the right (the drawer) and at the bottom (the HUD). */
export interface Insets {
  right: number;
  bottom: number;
}

/**
 * The constellation's center and radius on a screen, in pixels: centered in the room the HTML
 * leaves free, left of the right inset and above the bottom one.
 */
export function soulFrame(
  width: number,
  height: number,
  insets: Insets,
): { x: number; y: number; radius: number } {
  const w = Math.max(0, width - insets.right);
  const h = Math.max(0, height - insets.bottom);
  return { x: w / 2, y: h / 2, radius: (Math.min(w, h) / 2) * FILL };
}

export interface SoulView {
  container: Container;
  /**
   * Draws the constellation of creature `id` in `lite`, or only the page with none, in the room
   * `insets` leave free.
   */
  update(lite: WorldLite, settings: Settings, id: string | null, insets: Insets): void;
  /** The star or soul nearest a screen point within 44 pixels, or null. */
  pick(x: number, y: number): string | null;
  setPalette(p: Palette): void;
}

/**
 * The Soul view (spec 11.3): one creature drawn large on its own page in full color, for the first
 * time, among a constellation of every creature it has met. A friend is a star in its own full
 * color joined by a glowing line; a scar is a dark dashed line; one only met is a faint thin line.
 * The page hides the meadow. It reads snapshots only. Reduced motion stops the soul's boil; high
 * contrast thickens every line by half again.
 */
export function createSoulView(
  app: Application,
  firstPalette: Palette,
  rigs: Map<string, Rig>,
  cast: Map<string, Cast>,
  threshold: number,
): SoulView {
  let palette = firstPalette;
  const container = new Container({ label: 'soul' });
  const page = new Graphics({ label: 'page' });
  const constellation = new Graphics({ label: 'constellation' });
  container.addChild(page, constellation);
  let soul: { id: string; view: ReturnType<typeof createLineView> } | null = null;
  let nodes: { id: string; x: number; y: number }[] = [];

  function soulFor(id: string): ReturnType<typeof createLineView> | null {
    if (soul?.id === id) return soul.view;
    soul?.view.container.destroy({ children: true });
    soul = null;
    const rig = rigs.get(id) ?? rigs.get(FALLBACK_RIG);
    if (!rig) return null;
    const color = creatureColor(id, cast, palette);
    const view = createLineView(rig, { ink: palette.ink, accent: color, paper: palette.paper });
    view.container.label = id;
    container.addChild(view.container);
    soul = { id, view };
    return view;
  }

  return {
    container,
    update(lite, settings, id, insets) {
      const k = settings.highContrast ? HIGH_CONTRAST_WIDTH : 1;
      const { width, height } = app.screen;
      page.clear().rect(0, 0, width, height).fill(palette.background);
      constellation.clear();
      nodes = [];
      const view = id === null ? null : soulFor(id);
      if (soul) soul.view.container.visible = view !== null;
      if (id === null || !view) return;

      const frame = soulFrame(width, height, insets);
      const stars = soulLayout(lite, id, threshold).map((s) => ({
        ...s,
        x: frame.x + s.x * frame.radius,
        y: frame.y + s.y * frame.radius,
      }));
      for (const s of stars) {
        const color = creatureColor(s.id, cast, palette);
        const g = constellation.moveTo(frame.x, frame.y);
        if (s.kind === 'friend') {
          g.lineTo(s.x, s.y).stroke({ ...inkStroke(palette, GLOW_WIDTH * k, GLOW_ALPHA), color });
          g.moveTo(frame.x, frame.y)
            .lineTo(s.x, s.y)
            .stroke({ ...inkStroke(palette, TIE_WIDTH * k), color });
        } else if (s.kind === 'scar') {
          dashedLine(g, frame.x, frame.y, s.x, s.y, SCAR_DASH, SCAR_GAP).stroke(
            inkStroke(palette, TIE_WIDTH * k),
          );
        } else {
          g.lineTo(s.x, s.y).stroke(inkStroke(palette, MET_WIDTH * k, TUFT_ALPHA));
        }
      }
      for (const s of stars) {
        constellation
          .circle(s.x, s.y, STAR_RADIUS)
          .fill(creatureColor(s.id, cast, palette))
          .stroke(inkStroke(palette, STAR_LINE * k));
      }
      nodes = [...stars, { id, x: frame.x, y: frame.y }];

      const size = frame.radius * SOUL_HEIGHT;
      const c = lite.creatures.find((x) => x.id === id);
      const shell = c?.shell ?? { tightness: 0, bristle: 0, color: 0, softness: 0 };
      // The rig's origin is its base: the feet sit half a body below the center.
      view.container.position.set(frame.x, frame.y + size / 2);
      view.container.scale.set(size, -size);
      const seconds = Math.max(0, app.ticker.lastTime) / 1000;
      view.update(shell, seconds, settings.reducedMotion, 0, {
        body: creatureColor(id, cast, palette),
        widthScale: k,
      });
    },
    pick: (x, y) => nearestNode(nodes, x, y, SNAP_PIXELS),
    setPalette(p) {
      palette = p;
      soul?.view.container.destroy({ children: true });
      soul = null;
    },
  };
}
