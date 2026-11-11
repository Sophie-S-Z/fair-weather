import { readdirSync, readFileSync } from 'node:fs';
import { Container, Graphics, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import springJson from '../../../content/palettes/spring.json';
import meadowJson from '../../../content/scenes/kith-meadow.json';
import { CastSchema, type Cast } from '../../../src/render/cast.ts';
import { bodyColor } from '../../../src/render/line/fill.ts';
import { RigSchema, type Rig } from '../../../src/render/line/rig.ts';
import { bodyHeight, createMeadowView, rigArea } from '../../../src/render/meadow-view.ts';
import { PaletteSchema } from '../../../src/render/palette.ts';
import { SceneSchema } from '../../../src/render/scene.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import type { Settings } from '../../../src/ui/settings.ts';

const scene = SceneSchema.parse(meadowJson);
const palette = PaletteSchema.parse(springJson);
const rigs = new Map<string, Rig>(
  readdirSync('content/rigs')
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const rig = RigSchema.parse(JSON.parse(readFileSync(`content/rigs/${f}`, 'utf8')));
      return [rig.id, rig];
    }),
);
const cast = new Map<string, Cast>(
  readdirSync('content/cast')
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const c = CastSchema.parse(JSON.parse(readFileSync(`content/cast/${f}`, 'utf8')));
      return [c.id, c];
    }),
);
const options = { lensRadius: tuningJson.light.lensRadius, cast };
const rig = (id: string): Rig => {
  const r = rigs.get(id);
  if (!r) throw new Error(`no rig ${id}`);
  return r;
};
/** The drawn height of a creature, as the view sizes it. */
const heightOf = (id: string): number =>
  bodyHeight(rigs.get(id) ?? rig('villager'), rigArea(rig('villager')), cast.get(id)?.scale ?? 1);
const settings: Settings = {
  textScale: 1,
  highContrast: false,
  reducedMotion: false,
  sound: false,
  analytics: false,
};
const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const snapshot = (
  creatures: [string, number, number, WorldLite['creatures'][number]['state']?][],
): WorldLite => ({
  creatures: creatures.map(([id, x, y, state = 'wander']) => ({
    id,
    x,
    y,
    state,
    shell,
    berries: 0,
    skyWarmth: 0,
  })),
  light: { x: 800, y: 450 },
  fog: { w: 40, h: 23, cells: new Float32Array(40 * 23).fill(0.5) },
  metrics: { averageWarmth: 0, friendPairs: 0 },
  structures: [{ id: 'b1', kind: 'bench', x: 600, y: 425 }],
});

/** A stand-in for a Pixi Application: the view reads only the stage, screen, and ticker. */
function fakeApp(width: number, height: number): Application {
  return {
    stage: new Container(),
    screen: { width, height },
    ticker: { lastTime: 0, deltaMS: 16 },
  } as unknown as Application;
}

/** The creature's line-view container, found by its label. */
function creatureIn(app: Application, id: string): Container {
  const found = app.stage.getChildByLabel(id, true);
  if (!found) throw new Error(`no view for ${id}`);
  return found;
}
/** The body fill color of a creature: the first fill of its body Graphics. */
function bodyFillOf(app: Application, id: string): number {
  const body = creatureIn(app, id).children[0];
  if (!(body instanceof Graphics)) throw new Error('no body');
  const fill = body.context.instructions.find((i) => i.action === 'fill');
  return (fill?.data.style as { color: number }).color;
}

test('the content parses and matches the tuning', () => {
  expect([scene.width, scene.height]).toEqual([tuningJson.scene.width, tuningJson.scene.height]);
  expect(scene.cameras['crooked-tree']).toBeDefined();
  expect(scene.cameras['pim-close']).toEqual({ follow: 'pim', zoom: expect.any(Number) as number });
  expect(scene.trees.some((t) => t.id === 'crooked-tree')).toBe(true);
});

test('pick returns the nearest creature within the hit radius and null elsewhere', () => {
  // Screen 800 x 450 shows the 1600 x 900 scene at scale 0.5 with no offset.
  const view = createMeadowView(fakeApp(800, 450), scene, rigs, palette, options);
  const world = snapshot([
    ['pim', 400, 400],
    ['villager-1', 460, 400],
    ['far', 1200, 800, 'away'],
  ]);
  view.update(world, world, 1, settings);
  // Creatures are picked by their body center, half a body above their feet, within half a body.
  const pimY = (400 - heightOf('pim') / 2) * 0.5;
  const villagerY = (400 - heightOf('villager-1') / 2) * 0.5;
  expect(view.pick(400 * 0.5, pimY)).toBe('pim');
  // Between the two at the villager's center height, nearer villager-1.
  expect(view.pick(445 * 0.5, villagerY)).toBe('villager-1');
  expect(view.pick(400 * 0.5, pimY - (heightOf('pim') / 2 + 1) * 0.5)).toBeNull();
  expect(view.pick(10, 10)).toBeNull();
  // Away creatures are not drawn and cannot be picked.
  expect(view.pick(1200 * 0.5, (800 - heightOf('villager-1') / 2) * 0.5)).toBeNull();
});

test('pick follows the interpolated position', () => {
  const view = createMeadowView(fakeApp(800, 450), scene, rigs, palette, options);
  view.update(snapshot([['pim', 200, 400]]), snapshot([['pim', 600, 400]]), 0.5, settings);
  expect(view.pick(400 * 0.5, (400 - heightOf('pim') / 2) * 0.5)).toBe('pim');
  expect(view.pick(200 * 0.5, (400 - heightOf('pim') / 2) * 0.5)).toBeNull();
});

test('a camera shot eases in, and reduced motion jumps straight to it', () => {
  const world = snapshot([['pim', 400, 400]]);
  const zoomOf = (reducedMotion: boolean): number => {
    const app = fakeApp(800, 450);
    const view = createMeadowView(app, scene, rigs, palette, options);
    view.update(world, world, 1, settings);
    view.setShot('crooked-tree');
    view.update(world, world, 1, { ...settings, reducedMotion });
    return app.stage.children[0]?.scale.x ?? 0;
  };
  // The whole scene fits at 0.5; the crooked-tree shot zooms 2x, to 1.
  expect(zoomOf(true)).toBe(1);
  const eased = zoomOf(false);
  expect(eased).toBeGreaterThan(0.5);
  expect(eased).toBeLessThan(1);
});

test('a shot can follow a creature', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([['pim', 900, 500]]);
  view.setShot('pim-close');
  view.update(world, world, 1, { ...settings, reducedMotion: true });
  // Pim's body center sits at the screen center.
  expect(view.pick(400, 225)).toBe('pim');
});

test('only the focus creature wears the accent; the rest show shell color as a muted tint', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const warm = { ...shell, color: 1 };
  const world: WorldLite = {
    ...snapshot([]),
    creatures: [
      { id: 'pim', x: 300, y: 400, state: 'wander', shell, berries: 0, skyWarmth: 0 },
      { id: 'krit', x: 600, y: 400, state: 'wander', shell: warm, berries: 0, skyWarmth: 0 },
      { id: 'villager-1', x: 900, y: 400, state: 'wander', shell, berries: 0, skyWarmth: 0 },
    ],
  };
  view.setFocus('pim');
  view.update(world, world, 1, settings);
  const pimAccent = bodyFillOf(app, 'pim');
  expect(pimAccent).not.toBe(palette.paper);
  expect(bodyFillOf(app, 'krit')).toBe(bodyColor(palette.paper, palette.warmth, 1));
  expect(bodyFillOf(app, 'villager-1')).toBe(palette.paper);
  // The muted tint is clearly not the accent: a far bigger channel gap than rounding.
  const gap = (a: number, b: number): number =>
    Math.max(...[16, 8, 0].map((sh) => Math.abs(((a >> sh) & 0xff) - ((b >> sh) & 0xff))));
  expect(gap(bodyFillOf(app, 'krit'), pimAccent)).toBeGreaterThan(40);

  view.setFocus(null);
  view.update(world, world, 1, settings);
  expect(bodyFillOf(app, 'pim')).toBe(palette.paper);
  expect(bodyFillOf(app, 'krit')).toBe(bodyColor(palette.paper, palette.warmth, 1));
});

test('creatures sway, and reduced motion stops the sway', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([['pim', 400, 400]]);
  view.update(world, world, 1, settings);
  expect(creatureIn(app, 'pim').rotation).not.toBe(0);
  view.update(world, world, 1, { ...settings, reducedMotion: true });
  expect(creatureIn(app, 'pim').rotation).toBe(0);
});

test('the named cast are drawn at least as large as a villager', () => {
  for (const id of ['pim', 'krit', 'echo', 'moss', 'wisp', 'bell']) {
    const area = (h: number, r: Rig): number => rigArea(r) * h * h;
    expect(area(heightOf(id), rig(id))).toBeGreaterThanOrEqual(area(heightOf('villager-1'), rig('villager')));
  }
});

test('trees, benches, and creatures share one layer sorted by base y', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([['pim', 590, 300]]);
  view.update(world, world, 1, settings);
  const tree = app.stage.getChildByLabel('crooked-tree', true);
  const bench = app.stage.getChildByLabel('b1', true);
  const pim = creatureIn(app, 'pim');
  expect(tree?.parent).toBe(pim.parent);
  expect(bench?.parent).toBe(pim.parent);
  // Pim stands behind the crooked tree (base y 420) and the bench (y 425).
  expect(pim.zIndex).toBeLessThan(tree?.zIndex ?? 0);
  expect(pim.zIndex).toBeLessThan(bench?.zIndex ?? 0);
});
