import { readdirSync, readFileSync } from 'node:fs';
import { Container, Graphics, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import springJson from '../../../content/palettes/spring.json';
import { RigSchema, type Rig } from '../../../src/render/line/rig.ts';
import { PaletteSchema } from '../../../src/render/palette.ts';
import { createSoulView, soulFrame, soulLayout } from '../../../src/render/soul-view.ts';
import type { Settings } from '../../../src/ui/settings.ts';
import { lite } from './lite-fixture.ts';

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
  reducedMotion: true,
  sound: false,
  analytics: false,
};
const fakeApp = (): Application =>
  ({
    stage: new Container(),
    screen: { width: 1280, height: 720 },
    ticker: { lastTime: 0 },
  }) as unknown as Application;

test('soulLayout puts a warmer creature nearer, and leaves out creatures with no tie', () => {
  const w = lite(
    [['pim'], ['krit'], ['echo'], ['bell']],
    [
      ['krit', 'pim', 0.9, 0.1],
      ['echo', 'pim', 0.9, 0.9],
      ['bell', 'krit', 0.9, 0.9],
    ],
  );
  const stars = soulLayout(w, 'pim', 0.3);
  expect(stars.map((s) => [s.id, s.kind])).toEqual([
    ['echo', 'friend'],
    ['krit', 'met'],
  ]);
  const [echo, krit] = stars.map((s) => Math.hypot(s.x, s.y));
  expect(echo).toBeLessThan(krit ?? 0);
});

test('soulLayout reads the warmth from the soul toward the other, on either side of the tie', () => {
  const w = lite([['pim'], ['krit']], [['krit', 'pim', 0.9, -0.5]]);
  const [fromPim] = soulLayout(w, 'pim', 0.3);
  const [fromKrit] = soulLayout(w, 'krit', 0.3);
  expect(fromPim?.kind).toBe('scar');
  expect(Math.hypot(fromPim?.x ?? 0, fromPim?.y ?? 0)).toBeGreaterThan(
    Math.hypot(fromKrit?.x ?? 0, fromKrit?.y ?? 0),
  );
});

test('soulLayout spreads the stars round the soul in id order, starting at the top', () => {
  const w = lite(
    [['pim'], ['a'], ['b'], ['c'], ['d']],
    [
      ['c', 'pim', 0, 0],
      ['a', 'pim', 0, 0],
      ['d', 'pim', 0, 0],
      ['b', 'pim', 0, 0],
    ],
  );
  const stars = soulLayout(w, 'pim', 0.3);
  expect(stars.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  const [a, b, c, d] = stars;
  expect(a?.x).toBeCloseTo(0);
  expect(a?.y).toBeLessThan(0);
  expect(b?.x).toBeGreaterThan(0);
  expect(c?.y).toBeGreaterThan(0);
  expect(d?.x).toBeLessThan(0);
});

test('Soul on a creature with no ties draws only the center', () => {
  const soul = createSoulView(fakeApp(), palette, rigs, 0.3);
  soul.update(lite([['pim'], ['krit']], []), settings, 'pim', 0);
  const stars = soul.container.getChildByLabel('constellation');
  if (!(stars instanceof Graphics)) throw new Error('no constellation');
  expect(stars.context.instructions).toEqual([]);
  expect(soul.container.getChildByLabel('pim')?.visible).toBe(true);
  expect(soul.pick(10, 10)).toBeNull();
});

test('Soul draws its stars in the full colors, and picks a star or the center', () => {
  const soul = createSoulView(fakeApp(), palette, rigs, 0.3);
  const w = lite(
    [['pim'], ['krit'], ['echo']],
    [
      ['krit', 'pim', 0.9, 0.9],
      ['echo', 'pim', -0.4, -0.4],
    ],
  );
  soul.update(w, settings, 'pim', 0);
  const stars = soul.container.getChildByLabel('constellation');
  if (!(stars instanceof Graphics)) throw new Error('no constellation');
  const colors = new Set(
    stars.context.instructions
      .filter((i) => i.action === 'fill')
      .map((i) => (i.data.style as { color: number }).color),
  );
  for (const c of colors) expect(palette.full).toContain(c);
  expect(colors.size).toBeGreaterThan(0);
  const frame = soulFrame(1280, 720, 0);
  const krit = soulLayout(w, 'pim', 0.3).find((s) => s.id === 'krit');
  const at = (s: { x: number; y: number }): [number, number] => [
    frame.x + s.x * frame.radius,
    frame.y + s.y * frame.radius,
  ];
  expect(soul.pick(...at({ x: krit?.x ?? 0, y: krit?.y ?? 0 }))).toBe('krit');
  expect(soul.pick(frame.x, frame.y)).toBe('pim');
});

test('soulFrame centers the constellation left of the drawer, clear of it at text size 1.5', () => {
  // The drawer is min(22rem, 100vw - 2rem) wide at 0.75rem from the right; at text size 1.5 a rem is 24 px.
  const inset = 22 * 24 + 0.75 * 24;
  const frame = soulFrame(1280, 720, inset);
  expect(frame.x).toBe((1280 - inset) / 2);
  expect(frame.y).toBe(360);
  // The farthest star (radius 12) stays left of the drawer.
  expect(frame.x + frame.radius + 12).toBeLessThan(1280 - inset);
  expect(soulFrame(300, 720, 400).radius).toBe(0);
});
