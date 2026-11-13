import { Container, Graphics, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import springJson from '../../../content/palettes/spring.json';
import { castColor, creatureColor } from '../../../src/render/cast.ts';
import { viewTransform, toScreen } from '../../../src/render/camera.ts';
import { cosmosEdges, createCosmosView, valleyTop, type Band } from '../../../src/render/cosmos-view.ts';
import { CREATURE_HEIGHT } from '../../../src/render/meadow-view.ts';
import { PaletteSchema } from '../../../src/render/palette.ts';
import type { Settings } from '../../../src/ui/settings.ts';
import { lite } from './lite-fixture.ts';
import { cast } from './content-fixture.ts';

const palette = PaletteSchema.parse(springJson);
const settings: Settings = {
  textScale: 1,
  highContrast: false,
  reducedMotion: false,
  sound: false,
  analytics: false,
};
const noTimeline = { points: [], breaks: [] };
const fakeApp = (): Application =>
  ({ stage: new Container(), screen: { width: 1280, height: 720 } }) as unknown as Application;
const same = (x: number, y: number): [number, number] => [x, y];

test('cosmosEdges keeps friends and scars, and leaves out plain ties and creatures away', () => {
  const w = lite(
    [['pim'], ['krit'], ['echo'], ['wisp', 'away'], ['bell']],
    [
      ['krit', 'pim', 0.5, 0.6],
      ['echo', 'krit', -0.2, 0.4],
      ['bell', 'pim', 0.2, 0.5],
      ['pim', 'wisp', 0.8, 0.8],
    ],
  );
  expect(cosmosEdges(w, 0.3)).toEqual([
    { a: 'krit', b: 'pim', kind: 'friend', warmth: 0.5 },
    { a: 'echo', b: 'krit', kind: 'scar', warmth: -0.2 },
  ]);
});

test('Cosmos pick snaps to a node 40 pixels away, but not 50', () => {
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  cosmos.update(lite([['pim', 'wander', 300, 200]], []), settings, same, noTimeline, null, null);
  expect(cosmos.pick(340, 200)).toBe('pim');
  expect(cosmos.pick(300, 250)).toBeNull();
});

test('Cosmos pick takes the nearest node, and never one away', () => {
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  const w = lite(
    [
      ['pim', 'wander', 300, 200],
      ['krit', 'wander', 330, 200],
      ['wisp', 'away', 320, 200],
    ],
    [],
  );
  cosmos.update(w, settings, same, noTimeline, null, null);
  expect(cosmos.pick(318, 200)).toBe('krit');
  expect(cosmos.pick(312, 200)).toBe('pim');
});

test('Cosmos fades the meadow to 25% under a wash of the page color', () => {
  const app = fakeApp();
  const cosmos = createCosmosView(app, palette, cast, 0.3);
  cosmos.update(lite([], []), settings, same, noTimeline, null, null);
  const veil = cosmos.container.getChildByLabel('veil');
  if (!(veil instanceof Graphics)) throw new Error('no veil');
  const fill = veil.context.instructions.find((i) => i.action === 'fill');
  expect(fill?.data.style).toMatchObject({ color: palette.background, alpha: 0.75 });
});

/** The width and alpha of every stroke the Cosmos drew between nodes. */
function edgeStrokes(cosmos: ReturnType<typeof createCosmosView>): { width: number; alpha: number }[] {
  const edges = cosmos.container.getChildByLabel('edges');
  if (!(edges instanceof Graphics)) throw new Error('no edges');
  return edges.context.instructions
    .filter((i) => i.action === 'stroke')
    .map((i) => {
      const { width, alpha } = i.data.style as { width: number; alpha: number };
      return { width, alpha };
    });
}

test('Cosmos draws friendships only, fainter the cooler, and the picked creature’s at full ink', () => {
  const w = lite(
    [['pim'], ['krit'], ['echo'], ['bell']],
    [
      ['krit', 'pim', 0.9, 0.9],
      ['bell', 'echo', 0.4, 0.4],
      ['echo', 'krit', -0.5, -0.5],
      ['echo', 'pim', 0.9, 0.9],
    ],
  );
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  cosmos.update(w, settings, same, noTimeline, null, null);
  const [warm, cool, warm2, ...rest] = edgeStrokes(cosmos);
  expect(rest).toEqual([]);
  expect(warm).toEqual(warm2);
  expect(cool?.width).toBe(warm?.width);
  expect(cool?.alpha).toBeLessThan(warm?.alpha ?? 0);

  cosmos.update(w, settings, same, noTimeline, null, 'pim');
  const strokes = edgeStrokes(cosmos);
  expect(strokes).toHaveLength(2);
  expect(strokes[1]).toEqual({ width: expect.any(Number) as number, alpha: 1 });
  expect(strokes[1]?.width).toBeGreaterThan(cool?.width ?? 0);
});

test('Cosmos raises the faintest friendship in high contrast', () => {
  const w = lite([['bell'], ['echo']], [['bell', 'echo', 0.31, 0.31]]);
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  cosmos.update(w, settings, same, noTimeline, null, null);
  const [plain] = edgeStrokes(cosmos);
  cosmos.update(w, { ...settings, highContrast: true }, same, noTimeline, null, null);
  const [strong] = edgeStrokes(cosmos);
  expect(strong?.alpha).toBeGreaterThanOrEqual(0.5);
  expect(strong?.alpha).toBeGreaterThan(plain?.alpha ?? 1);
});

/** The fill color and outline width of each node the Cosmos drew, in drawing order. */
function nodeStyles(cosmos: ReturnType<typeof createCosmosView>): { fill: number; line: number }[] {
  const dots = cosmos.container.getChildByLabel('nodes');
  if (!(dots instanceof Graphics)) throw new Error('no nodes');
  const ins = dots.context.instructions;
  const fills = ins.filter((i) => i.action === 'fill').map((i) => (i.data.style as { color: number }).color);
  const lines = ins
    .filter((i) => i.action === 'stroke')
    .map((i) => (i.data.style as { width: number }).width);
  return fills.map((fill, i) => ({ fill, line: lines[i] ?? 0 }));
}

test('the picked node lights up on top in its own color with a thick outline; villagers share one color', () => {
  const w = lite([['pim'], ['krit'], ['villager-1'], ['villager-2']], []);
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  const pim = cast.get('pim');
  if (!pim) throw new Error('no pim');
  cosmos.update(w, settings, same, noTimeline, null, null);
  const plain = nodeStyles(cosmos);
  expect(plain.every((n) => n.fill === palette.paper)).toBe(true);

  cosmos.update(w, settings, same, noTimeline, null, 'pim');
  const lit = nodeStyles(cosmos);
  expect(lit.at(-1)?.fill).toBe(castColor(pim, palette));
  expect(lit.at(-1)?.line).toBeGreaterThan(plain[0]?.line ?? Infinity);
  expect(lit.slice(0, -1).every((n) => n.fill === palette.paper)).toBe(true);

  // Each cast member has a color of its own; villagers share one more, outside the cast's.
  const shared = creatureColor('villager-1', cast, palette);
  expect(new Set([...cast.values()].map((c) => castColor(c, palette)).concat(shared)).size).toBe(
    cast.size + 1,
  );
  expect(shared).not.toBe(palette.paper);
  const villager = (id: string): number | undefined => {
    cosmos.update(w, settings, same, noTimeline, null, id);
    return nodeStyles(cosmos).at(-1)?.fill;
  };
  expect(villager('villager-1')).toBe(shared);
  expect(villager('villager-2')).toBe(shared);

  // High contrast keeps the lit node's outline thicker than every other node's.
  cosmos.update(w, { ...settings, highContrast: true }, same, noTimeline, null, 'pim');
  const strong = nodeStyles(cosmos);
  expect(strong.at(-1)?.line).toBeGreaterThan(Math.max(...strong.slice(0, -1).map((n) => n.line)));
});

test('the timeline strip is drawn in the band, and no node can reach the band', () => {
  const band: Band = { strip: { x: 320, y: 40, w: 640, h: 24 }, bottom: 68 };
  const app = fakeApp();
  const cosmos = createCosmosView(app, palette, cast, 0.3);
  const timeline = {
    points: [
      { tick: 0, population: 30, trust: 0 },
      { tick: 10, population: 31, trust: 0.1 },
    ],
    breaks: [],
  };
  cosmos.update(lite([], []), settings, same, timeline, band, null);
  const strip = cosmos.container.getChildByLabel('timeline');
  if (!(strip instanceof Graphics)) throw new Error('no strip');
  const b = strip.getLocalBounds();
  expect(b.minX).toBeGreaterThanOrEqual(band.strip.x - 3);
  expect(b.maxX).toBeLessThanOrEqual(band.strip.x + band.strip.w + 3);
  expect(b.minY).toBeGreaterThanOrEqual(band.strip.y - 3);
  expect(b.maxY).toBeLessThanOrEqual(band.strip.y + band.strip.h + 3);
  // The band hides the valley above the scene, under the strip.
  const backing = cosmos.container.getChildByLabel('band');
  if (!(backing instanceof Graphics)) throw new Error('no band');
  expect(backing.getLocalBounds().maxY).toBe(band.bottom);

  // With the valley fit below valleyTop, a creature on the scene's top edge keeps its whole node,
  // high-contrast outline and all, below the band, on a wide and on a tall screen.
  for (const [w, h] of [
    [1280, 720],
    [800, 1200],
  ] as const) {
    const t = viewTransform(1600, 900, w, h, undefined, valleyTop(band, h, 900));
    const [, y] = toScreen(t, 0, -CREATURE_HEIGHT / 2);
    expect(y - (9 + 5 / 2) * 1.5).toBeGreaterThanOrEqual(band.bottom);
  }
});

// Review Focus 5: an empty valley, and one creature with no ties, draw without a throw.
test('the Cosmos with no creatures, then one with no ties, draws no edges and picks only that one', () => {
  const band: Band = { strip: { x: 320, y: 40, w: 640, h: 24 }, bottom: 68 };
  const cosmos = createCosmosView(fakeApp(), palette, cast, 0.3);
  const one = { points: [{ tick: 0, population: 0, trust: 0 }], breaks: [] };
  expect(() => {
    cosmos.update(lite([], []), settings, same, one, band, null);
  }).not.toThrow();
  expect(edgeStrokes(cosmos)).toEqual([]);
  expect(cosmos.pick(300, 200)).toBeNull();
  const alone = lite([['pim', 'wander', 300, 200]], []);
  expect(() => {
    cosmos.update(alone, settings, same, one, band, 'pim');
  }).not.toThrow();
  expect(edgeStrokes(cosmos)).toEqual([]);
  expect(cosmos.pick(300, 200)).toBe('pim');
  expect(cosmos.pick(600, 600)).toBeNull();
});
