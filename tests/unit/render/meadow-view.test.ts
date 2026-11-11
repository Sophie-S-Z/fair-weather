import { readdirSync, readFileSync } from 'node:fs';
import { Container, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import springJson from '../../../content/palettes/spring.json';
import meadowJson from '../../../content/scenes/kith-meadow.json';
import { RigSchema, type Rig } from '../../../src/render/line/rig.ts';
import {
  CREATURE_HEIGHT,
  LENS_RADIUS,
  PICK_RADIUS,
  createMeadowView,
} from '../../../src/render/meadow-view.ts';
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

test('the content parses and matches the tuning', () => {
  expect([scene.width, scene.height]).toEqual([tuningJson.scene.width, tuningJson.scene.height]);
  expect(LENS_RADIUS).toBe(tuningJson.light.lensRadius);
  expect(scene.cameras['crooked-tree']).toBeDefined();
  expect(scene.trees.some((t) => t.id === 'crooked-tree')).toBe(true);
});

test('pick returns the nearest creature within the hit radius and null elsewhere', () => {
  // Screen 800 x 450 shows the 1600 x 900 scene at scale 0.5 with no offset.
  const view = createMeadowView(fakeApp(800, 450), scene, rigs, palette);
  const world = snapshot([
    ['pim', 400, 400],
    ['villager-1', 460, 400],
    ['far', 1200, 800, 'away'],
  ]);
  view.update(world, world, 1, settings);
  // Creatures are picked by their body center, half a body above their feet.
  const cy = (400 - CREATURE_HEIGHT / 2) * 0.5;
  expect(view.pick(400 * 0.5, cy)).toBe('pim');
  // Between the two, nearer villager-1.
  expect(view.pick(440 * 0.5, cy)).toBe('villager-1');
  expect(view.pick(400 * 0.5, cy + (PICK_RADIUS + 1) * 0.5)).toBeNull();
  expect(view.pick(10, 10)).toBeNull();
  // Away creatures are not drawn and cannot be picked.
  expect(view.pick(1200 * 0.5, (800 - CREATURE_HEIGHT / 2) * 0.5)).toBeNull();
});

test('pick follows the interpolated position', () => {
  const view = createMeadowView(fakeApp(800, 450), scene, rigs, palette);
  view.update(snapshot([['pim', 200, 400]]), snapshot([['pim', 600, 400]]), 0.5, settings);
  expect(view.pick(400 * 0.5, (400 - CREATURE_HEIGHT / 2) * 0.5)).toBe('pim');
  expect(view.pick(200 * 0.5, (400 - CREATURE_HEIGHT / 2) * 0.5)).toBeNull();
});

test('a camera shot eases in, and reduced motion jumps straight to it', () => {
  const world = snapshot([['pim', 400, 400]]);
  const zoomOf = (reducedMotion: boolean): number => {
    const app = fakeApp(800, 450);
    const view = createMeadowView(app, scene, rigs, palette);
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
