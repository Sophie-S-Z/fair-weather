import { readdirSync, readFileSync } from 'node:fs';
import { Container, Graphics, Mesh, MeshGeometry, Sprite, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import autumnJson from '../../../content/palettes/autumn.json';
import springJson from '../../../content/palettes/spring.json';
import meadowJson from '../../../content/scenes/kith-meadow.json';
import { bodyColor } from '../../../src/render/line/fill.ts';
import type { Rig } from '../../../src/render/line/rig.ts';
import {
  bodyHeight,
  createMeadowView,
  dewColor,
  rigArea,
  VISITOR_SIT_SECONDS,
  VISITOR_SPEED,
} from '../../../src/render/meadow-view.ts';
import { PaletteSchema } from '../../../src/render/palette.ts';
import { SceneSchema } from '../../../src/render/scene.ts';
import scenarioJson from '../../../content/scenarios/m0.json';
import { toLite } from '../../../src/sim-host/lite.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { bridgeDeck, islets } from '../../../src/sim/land.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Scenario } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import { SEASONS } from '../../../src/sim/types.ts';
import type { Settings } from '../../../src/ui/settings.ts';
import { rigs, cast } from './content-fixture.ts';

const scene = SceneSchema.parse(meadowJson);
const palette = PaletteSchema.parse(springJson);
const autumn = PaletteSchema.parse(autumnJson);
const tuning = parseTuning(tuningJson);
const options = {
  lensRadius: tuning.light.lensRadius,
  cast,
  gate: { x: tuning.scene.gateX, y: tuning.scene.gateY },
};
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
const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
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
    dancing: false,
    gone: false,
    dials,
  })),
  light: { x: 800, y: 450 },
  fog: { w: 40, h: 23, cells: new Float32Array(40 * 23).fill(0.5) },
  metrics: { averageWarmth: 0, friendPairs: 0 },
  structures: [{ id: 'b1', kind: 'bench', x: 600, y: 425 }],
  water: [],
  decks: [],
  islets: [],
  mushroom: null,
  bushes: [],
  ties: [],
  rumor: null,
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

test('every season has a palette', () => {
  const files = readdirSync('content/palettes').filter((f) => f.endsWith('.json'));
  const ids = files.map(
    (f) => PaletteSchema.parse(JSON.parse(readFileSync(`content/palettes/${f}`, 'utf8'))).id,
  );
  expect(ids.sort()).toEqual([...SEASONS].sort());
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

test('toScene maps a screen point through the camera', () => {
  const view = createMeadowView(fakeApp(800, 450), scene, rigs, palette, options);
  const world = snapshot([['pim', 400, 400]]);
  view.update(world, world, 1, settings);
  expect(view.toScene(300, 200)).toEqual([600, 400]);
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
      {
        id: 'pim',
        x: 300,
        y: 400,
        state: 'wander',
        shell,
        berries: 0,
        skyWarmth: 0,
        dials,
        dancing: false,
        gone: false,
      },
      {
        id: 'krit',
        x: 600,
        y: 400,
        state: 'wander',
        shell: warm,
        berries: 0,
        skyWarmth: 0,
        dials,
        dancing: false,
        gone: false,
      },
      {
        id: 'villager-1',
        x: 900,
        y: 400,
        state: 'wander',
        shell,
        berries: 0,
        skyWarmth: 0,
        dials,
        dancing: false,
        gone: false,
      },
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

/** Every display object under `c`. */
const objectCount = (c: Container): number => c.children.reduce((n, ch) => n + 1 + objectCount(ch), 0);
/** The fills of a Graphics, as color, alpha, and the bounds of the filled path. */
function fillsOf(
  g: Graphics,
): { color: number; alpha: number; minX: number; minY: number; maxX: number; maxY: number }[] {
  return g.context.instructions.flatMap((i) => {
    if (i.action !== 'fill') return [];
    const { color, alpha } = i.data.style as { color: number; alpha: number };
    const { minX, minY, maxX, maxY } = i.data.path.bounds;
    return [{ color, alpha, minX, minY, maxX, maxY }];
  });
}
function graphicsIn(app: Application, label: string): Graphics {
  const g = app.stage.getChildByLabel(label, true);
  if (!(g instanceof Graphics)) throw new Error(`no graphics ${label}`);
  return g;
}

test('water, a bridge, a lantern, and the mushroom add a few objects, none per creature', () => {
  const crowd = snapshot(
    Array.from({ length: 30 }, (_, i) => [`villager-${String(i + 1)}`, 100 + i * 45, 600]),
  );
  const land: WorldLite = {
    ...crowd,
    water: [{ x: 780, y: 0, w: 60, h: 900 }],
    structures: [
      ...crowd.structures,
      { id: 'br1', kind: 'bridge', x: 810, y: 300 },
      { id: 'l1', kind: 'lantern', x: 400, y: 300 },
    ],
    decks: [{ x: 714, y: 268, w: 192, h: 64, eastWest: true }],
    mushroom: { x: 1000, y: 500, drops: 4, witherDays: 0 },
  };
  const count = (world: WorldLite): number => {
    const app = fakeApp(800, 450);
    createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
    return objectCount(app.stage);
  };
  expect(count(land) - count(crowd)).toBeLessThanOrEqual(4);
});

test('the water is drawn in the palette water color, and a new palette redraws the scene', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world: WorldLite = { ...snapshot([['pim', 400, 400]]), water: [{ x: 780, y: 0, w: 60, h: 900 }] };
  view.update(world, world, 1, settings);
  expect(fillsOf(graphicsIn(app, 'land')).map((f) => f.color)).toContain(palette.water);
  view.setPalette(autumn);
  view.update(world, world, 1, settings);
  expect(fillsOf(graphicsIn(app, 'land')).map((f) => f.color)).toContain(autumn.water);
  expect(fillsOf(graphicsIn(app, 'ground'))[0]?.color).toBe(autumn.background);
  expect(bodyFillOf(app, 'pim')).toBe(autumn.paper);
});

test('the mushroom shows one dot per drop', () => {
  const dots = (drops: number): number => {
    const app = fakeApp(800, 450);
    const world: WorldLite = { ...snapshot([]), mushroom: { x: 1000, y: 500, drops, witherDays: 0 } };
    createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
    return graphicsIn(app, 'mushroom').context.instructions.filter(
      (i) => i.action === 'fill' && (i.data.style as { color: number }).color === dewColor(palette),
    ).length;
  };
  expect(dots(0)).toBe(0);
  expect(dots(4)).toBe(4);
});

/** How many of a creature's line points have no width: the gaps between its dashes. */
function gapsOf(app: Application, id: string): number {
  const line = creatureIn(app, id).children[1];
  if (!(line instanceof Mesh) || !(line.geometry instanceof MeshGeometry)) throw new Error('no line');
  const p = line.geometry.positions;
  let n = 0;
  for (let k = 0; k < p.length; k += 4) if (p[k] === p[k + 2] && p[k + 1] === p[k + 3]) n += 1;
  return n;
}

test('a creature in fog is drawn in dashes', () => {
  const gaps = (fog: number): number => {
    const app = fakeApp(800, 450);
    const world = snapshot([['pim', 400, 400]]);
    world.fog.cells.fill(fog);
    createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
    return gapsOf(app, 'pim');
  };
  expect(gaps(0)).toBe(0);
  expect(gaps(0.2)).toBe(0);
  expect(gaps(0.5)).toBeGreaterThan(30);
});

test('a creature beside a lantern is not dashed where the raw fog would dash it', () => {
  // Fog 0.4 dashes a line; a lantern halves it to 0.2 (lantern.fogFactor), under the dash threshold.
  const gaps = (lantern: boolean): number => {
    const world = createWorld(1, tuning, scenarioJson as Scenario);
    world.fields.fog.fill(0.4);
    if (lantern) world.structures.push({ id: 'l1', kind: 'lantern', x: 460, y: 400 });
    const pim = world.creatures.find((c) => c.id === 'pim');
    if (pim) [pim.x, pim.y] = [400, 400];
    const lite = toLite(world, tuning);
    const app = fakeApp(800, 450);
    createMeadowView(app, scene, rigs, palette, options).update(lite, lite, 1, settings);
    return gapsOf(app, 'pim');
  };
  expect(gaps(false)).toBeGreaterThan(30);
  expect(gaps(true)).toBe(0);
});

test('bushes show one ink dot per berry, up to five', () => {
  const app = fakeApp(800, 450);
  const world: WorldLite = {
    ...snapshot([]),
    bushes: [
      { id: 'bush-1', x: 300, y: 300, berries: 3 },
      { id: 'bush-2', x: 500, y: 300, berries: 0 },
      { id: 'bush-3', x: 700, y: 300, berries: 9 },
    ],
  };
  createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
  const berries = (id: string): number =>
    fillsOf(graphicsIn(app, id)).filter((f) => f.color === palette.ink).length;
  expect([berries('bush-1'), berries('bush-2'), berries('bush-3')]).toEqual([3, 0, 5]);
});

test("a bridge deck is drawn where the snapshot puts it, the sim's own deck", () => {
  const app = fakeApp(800, 450);
  const water = [{ x: 780, y: 0, w: 60, h: 900 }];
  const bridge = { id: 'br1', kind: 'bridge' as const, x: 810, y: 300 };
  const deck = bridgeDeck(bridge, water, tuning);
  if (!deck) throw new Error('no deck');
  const world: WorldLite = { ...snapshot([]), water, structures: [bridge], decks: [deck] };
  createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
  const drawn = fillsOf(graphicsIn(app, 'land')).find((f) => f.color === palette.paper);
  expect([drawn?.minX, drawn?.minY, drawn?.maxX, drawn?.maxY]).toEqual([
    deck.x,
    deck.y,
    deck.x + deck.w,
    deck.y + deck.h,
  ]);
  // It crosses the brook and its banks.
  expect(drawn?.minX).toBeLessThan(780 - tuning.bank.side);
  expect(drawn?.maxX).toBeGreaterThan(840 + tuning.bank.side);
});

test('ground the water closes in is drawn as an islet', () => {
  const app = fakeApp(800, 450);
  // The ch6 pond: a ring of water round a 60 x 60 islet at (990, 390).
  const water = [
    { x: 950, y: 350, w: 140, h: 40 },
    { x: 950, y: 450, w: 140, h: 40 },
    { x: 950, y: 390, w: 40, h: 60 },
    { x: 1050, y: 390, w: 40, h: 60 },
  ];
  const world: WorldLite = { ...snapshot([]), water, islets: islets(water) };
  createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
  const isle = fillsOf(graphicsIn(app, 'land')).filter((f) => f.color === palette.background);
  expect(isle).toHaveLength(1);
  // Its ground covers the islet and reaches a little onto the water.
  expect(isle[0]?.minX).toBeLessThan(990);
  expect(isle[0]?.maxX).toBeGreaterThan(1050);
  expect(isle[0]?.maxX).toBeLessThan(1090);
});

test('dancing creatures hop, and reduced motion stops the hop', () => {
  const app = fakeApp(800, 450);
  (app.ticker as { lastTime: number }).lastTime = 200;
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([
    ['bell', 400, 400],
    ['pim', 600, 400],
  ]);
  const bell = world.creatures[0];
  if (bell) bell.dancing = true;
  view.update(world, world, 1, settings);
  expect(creatureIn(app, 'bell').y).toBeLessThan(400);
  expect(creatureIn(app, 'pim').y).toBe(400);
  view.update(world, world, 1, { ...settings, reducedMotion: true });
  expect(creatureIn(app, 'bell').y).toBe(400);
});

test('the heat map shades the cell the lens stayed over most, and turning it off starts a new count', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const lensAt = (x: number, y: number, times: number): void => {
    for (let i = 0; i < times; i++) view.countLens({ ...snapshot([]), light: { x, y } });
    const drawn = snapshot([]);
    view.update(drawn, drawn, 1, settings);
  };
  /** The wash's cells, one alpha byte per cell of the 16 x 9 grid. */
  const cells = (): number[] => {
    const heat = app.stage.getChildByLabel('heatmap', true);
    if (!(heat instanceof Sprite)) throw new Error('no heat map');
    const texels = heat.texture.source.resource as Uint8Array;
    return Array.from({ length: 16 * 9 }, (_, i) => texels[4 * i + 3] ?? 0);
  };
  const heat = app.stage.getChildByLabel('heatmap', true);
  lensAt(250, 150, 10);
  lensAt(1250, 750, 3);
  lensAt(700, 450, 1);
  expect(heat?.visible).toBe(false);
  view.showHeatmap(true);
  lensAt(1250, 750, 1);
  expect(heat?.visible).toBe(true);
  const shares = cells();
  expect(shares.filter((v) => v > 0)).toHaveLength(3);
  // The 16 x 9 grid over the 1600 x 900 scene has 100-unit cells: (250, 150) is column 2, row 1.
  expect(shares.indexOf(Math.max(...shares))).toBe(1 * 16 + 2);
  expect(shares[7 * 16 + 12]).toBe(Math.round((4 / 10) * 255));

  view.showHeatmap(false);
  expect(heat?.visible).toBe(false);
  view.showHeatmap(true);
  lensAt(1250, 750, 1);
  expect(cells().filter((v) => v > 0)).toHaveLength(1);
});

test('the keyboard cursor is one still ink ring, thicker in high contrast, hidden by null', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([]);
  const ring = app.stage.getChildByLabel('cursor', true);
  if (!(ring instanceof Graphics)) throw new Error('no cursor');
  const width = (): number => {
    const s = ring.context.instructions.find((i) => i.action === 'stroke');
    return (s?.data.style as { width: number }).width;
  };
  view.update(world, world, 1, settings);
  expect(ring.visible).toBe(false);
  view.setCursor({ x: 300, y: 200 });
  view.update(world, world, 1, settings);
  expect(ring.visible).toBe(true);
  expect(ring.getLocalBounds().x).toBeCloseTo(300 - 16 - width() / 2, 0);
  const plain = width();
  view.update(world, world, 1, { ...settings, highContrast: true });
  expect(width()).toBeGreaterThan(plain);
  // Reduced motion changes nothing: the ring never moves on its own.
  const before = ring.getLocalBounds().x;
  view.update(world, world, 1, { ...settings, reducedMotion: true, highContrast: true });
  expect(ring.getLocalBounds().x).toBe(before);
  view.setCursor(null);
  view.update(world, world, 1, settings);
  expect(ring.visible).toBe(false);
});

test('every glow sits on what makes it and moves with the camera, at any zoom', () => {
  // The lens glow on the lens, a lantern's glow on its lamp, and each fog and heat cell on its
  // cell's center: all in scene units under the one camera, so a zoomed shot moves them together.
  const world: WorldLite = {
    ...snapshot([]),
    light: { x: 700, y: 380 },
    structures: [{ id: 'l1', kind: 'lantern', x: 520, y: 420 }],
  };
  const near = (a: { x: number; y: number }, [x, y]: [number, number]): void => {
    expect(a.x).toBeCloseTo(x, 6);
    expect(a.y).toBeCloseTo(y, 6);
  };
  for (const shot of [null, 'crooked-tree']) {
    const app = fakeApp(800, 450);
    const view = createMeadowView(app, scene, rigs, palette, options);
    view.setShot(shot);
    view.countLens(world);
    view.showHeatmap(true);
    view.update(world, world, 1, { ...settings, reducedMotion: true });

    const lens = app.stage.getChildByLabel('light', true);
    if (!lens) throw new Error('no lens glow');
    near(lens.toGlobal({ x: 0, y: 0 }), view.toScreen(700, 380));

    const lantern = graphicsIn(app, 'l1');
    const [glow, , , lamp] = fillsOf(lantern);
    const center = (f?: { minX: number; minY: number; maxX: number; maxY: number }) => ({
      x: ((f?.minX ?? 0) + (f?.maxX ?? 0)) / 2,
      y: ((f?.minY ?? 0) + (f?.maxY ?? 0)) / 2,
    });
    expect(center(glow)).toEqual(center(lamp));
    near(lantern.toGlobal(center(glow)), view.toScreen(520, 420 - 40));

    // A texel's center is its cell's center: fog cells are 40 units, heat cells 100.
    for (const [label, cell] of [
      ['fog', 1600 / 40],
      ['heatmap', 1600 / 16],
    ] as const) {
      const wash = app.stage.getChildByLabel(label, true);
      if (!wash) throw new Error(`no ${label}`);
      near(wash.toGlobal({ x: 3.5, y: 2.5 }), view.toScreen(3.5 * cell, 2.5 * cell));
    }
  }
});

test('each creature has a shadow at its feet, under the water, and a hop leaves it on the ground', () => {
  const app = fakeApp(800, 450);
  (app.ticker as { lastTime: number }).lastTime = 200;
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world: WorldLite = {
    ...snapshot([
      ['bell', 400, 400],
      ['villager-1', 600, 500],
    ]),
    water: [{ x: 780, y: 0, w: 60, h: 900 }],
  };
  const bell = world.creatures[0];
  if (bell) bell.dancing = true;
  view.update(world, world, 1, settings);
  const shadows = graphicsIn(app, 'shadows');
  const land = graphicsIn(app, 'land');
  expect(shadows.parent?.getChildIndex(shadows)).toBeLessThan(land.parent?.getChildIndex(land) ?? -1);
  const ovals = fillsOf(shadows);
  expect(ovals.map((o) => [(o.minX + o.maxX) / 2, (o.minY + o.maxY) / 2])).toEqual([
    [expect.closeTo(400, 6), expect.closeTo(400, 6)],
    [expect.closeTo(600, 6), expect.closeTo(500, 6)],
  ]);
  expect(creatureIn(app, 'bell').y).toBeLessThan(400);
  // Darker in high contrast.
  view.update(world, world, 1, { ...settings, highContrast: true });
  expect(fillsOf(graphicsIn(app, 'shadows'))[0]?.alpha).toBeGreaterThan(ovals[0]?.alpha ?? 1);
});

test('a creature on a bridge deck has its shadow on the deck, not under it', () => {
  const app = fakeApp(800, 450);
  const water = [{ x: 780, y: 0, w: 60, h: 900 }];
  const bridge = { id: 'br1', kind: 'bridge' as const, x: 810, y: 300 };
  const deck = bridgeDeck(bridge, water, tuning);
  if (!deck) throw new Error('no deck');
  const world: WorldLite = {
    ...snapshot([
      ['pim', 810, 300],
      ['villager-1', 400, 500],
    ]),
    water,
    structures: [bridge],
    decks: [deck],
  };
  createMeadowView(app, scene, rigs, palette, options).update(world, world, 1, settings);
  const land = graphicsIn(app, 'land');
  const onDeck = graphicsIn(app, 'deck-shadows');
  expect(onDeck.parent?.getChildIndex(onDeck)).toBeGreaterThan(land.parent?.getChildIndex(land) ?? Infinity);
  const centers = (label: string): number[][] =>
    fillsOf(graphicsIn(app, label)).map((o) => [
      Math.round((o.minX + o.maxX) / 2),
      Math.round((o.minY + o.maxY) / 2),
    ]);
  expect(centers('deck-shadows')).toEqual([[810, 300]]);
  expect(centers('shadows')).toEqual([[400, 500]]);
});

test('the Quiet Visitor walks from the gate to the nearest bench, sits 20 s with a feather, and walks out', async () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([['pim', 400, 400]]);
  /** Draws frames 0.1 s apart from `now` up to `seconds`. */
  let now = 99.9;
  const at = (seconds: number, w: WorldLite = world, s: Settings = settings): void => {
    do {
      now = Math.min(seconds, now + 0.1);
      (app.ticker as { lastTime: number }).lastTime = now * 1000;
      view.update(w, w, 1, s);
    } while (now < seconds);
  };
  const { gate } = options;
  // The bench b1 at (600, 425) is nearer the gate than any bench spot.
  const walk = Math.hypot(600 - gate.x, 425 - gate.y) / VISITOR_SPEED;
  let gone = false;
  void view.visitor().then(() => (gone = true));
  at(100);
  const visitor = creatureIn(app, 'visitor');
  const feather = graphicsIn(app, 'feather');
  expect([visitor.visible, visitor.x, visitor.y]).toEqual([true, gate.x, gate.y]);
  expect(feather.visible).toBe(false);
  at(100 + walk / 2);
  expect(visitor.x).toBeGreaterThan(gate.x);
  expect(visitor.x).toBeLessThan(600);
  // Seated on the bench, drawn in front of it, with its feather beside it.
  at(100 + walk + 0.1);
  expect(visitor.x).toBe(600);
  expect(visitor.y).toBeLessThan(425);
  expect(visitor.zIndex).toBeGreaterThan(425);
  expect(feather.visible).toBe(true);
  at(100 + walk + VISITOR_SIT_SECONDS - 0.1);
  expect(visitor.x).toBe(600);
  expect(view.pick(...view.toScreen(600, 400))).toBeNull();
  at(100 + walk * 1.5 + VISITOR_SIT_SECONDS);
  expect(visitor.x).toBeLessThan(600);
  expect(gone).toBe(false);
  at(100 + walk * 2 + VISITOR_SIT_SECONDS + 0.1);
  await Promise.resolve();
  expect(gone).toBe(true);
  expect(visitor.visible).toBe(false);
  expect(feather.visible).toBe(false);

  // Without a bench it sits at the bench spot nearest the gate; reduced motion shows it seated, then gone.
  const still = { ...settings, reducedMotion: true };
  const open = { ...world, structures: [] };
  void view.visitor().then(() => (gone = true));
  gone = false;
  now = 199.9;
  at(200, open, still);
  expect([visitor.visible, visitor.x, visitor.y]).toEqual([true, 290, 700]);
  at(200 + VISITOR_SIT_SECONDS - 0.2, open, still);
  expect([visitor.visible, visitor.x, feather.visible]).toEqual([true, 290, true]);
  at(200 + VISITOR_SIT_SECONDS + 0.2, open, still);
  await Promise.resolve();
  expect([gone, visitor.visible, feather.visible]).toEqual([true, false, false]);
});

test('a stalled page does not skip the visit: one late frame moves it on a quarter second at most', () => {
  const app = fakeApp(800, 450);
  const view = createMeadowView(app, scene, rigs, palette, options);
  const world = snapshot([['pim', 400, 400]]);
  const frame = (seconds: number): void => {
    (app.ticker as { lastTime: number }).lastTime = seconds * 1000;
    view.update(world, world, 1, settings);
  };
  frame(1);
  void view.visitor();
  frame(1.1);
  frame(200);
  const visitor = creatureIn(app, 'visitor');
  expect(visitor.visible).toBe(true);
  expect(visitor.x).toBeCloseTo(
    options.gate.x +
      0.25 *
        VISITOR_SPEED *
        ((600 - options.gate.x) / Math.hypot(600 - options.gate.x, 425 - options.gate.y)),
    5,
  );
});
