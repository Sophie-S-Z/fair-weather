import { Container, Graphics, type Application } from 'pixi.js';
import { expect, test } from 'vitest';
import springJson from '../../../content/palettes/spring.json';
import { cosmosEdges, createCosmosView } from '../../../src/render/cosmos-view.ts';
import { PaletteSchema } from '../../../src/render/palette.ts';
import type { Settings } from '../../../src/ui/settings.ts';
import { lite } from './lite-fixture.ts';

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
  const cosmos = createCosmosView(fakeApp(), palette, 0.3);
  cosmos.update(lite([['pim', 'wander', 300, 200]], []), settings, same, noTimeline);
  expect(cosmos.pick(340, 200)).toBe('pim');
  expect(cosmos.pick(300, 250)).toBeNull();
});

test('Cosmos pick takes the nearest node, and never one away', () => {
  const cosmos = createCosmosView(fakeApp(), palette, 0.3);
  const w = lite(
    [
      ['pim', 'wander', 300, 200],
      ['krit', 'wander', 330, 200],
      ['wisp', 'away', 320, 200],
    ],
    [],
  );
  cosmos.update(w, settings, same, noTimeline);
  expect(cosmos.pick(318, 200)).toBe('krit');
  expect(cosmos.pick(312, 200)).toBe('pim');
});

test('Cosmos fades the meadow to 25% under a wash of the page color', () => {
  const app = fakeApp();
  const cosmos = createCosmosView(app, palette, 0.3);
  cosmos.update(lite([], []), settings, same, noTimeline);
  const veil = cosmos.container.getChildByLabel('veil');
  if (!(veil instanceof Graphics)) throw new Error('no veil');
  const fill = veil.context.instructions.find((i) => i.action === 'fill');
  expect(fill?.data.style).toMatchObject({ color: palette.background, alpha: 0.75 });
});
