// Dev page: draws the Pim rig. ?shell=t,b,c,s sets the shell; ?frame=N renders boil frame N once;
// ?pair=1 draws two overlapping Pims.
import { Application } from 'pixi.js';
import pimJson from '../content/rigs/PLACEHOLDER-pim.rig.json';
import { RigSchema } from '../src/render/line/rig.ts';
import { BOIL_FPS } from '../src/render/line/deform.ts';
import { createLineView } from '../src/render/line/line-view.ts';
import type { Shell } from '../src/sim/types.ts';

const SIZE = 400;
const SCALE = 240;
const INK = 0x2b2a28;
const ACCENT = 0xf7c59f;
const PAPER = 0xffffff;

const params = new URLSearchParams(location.search);
const [tightness = 0, bristle = 0, color = 0, softness = 0] = (params.get('shell') ?? '')
  .split(',')
  .map(Number)
  .map((v) => (Number.isFinite(v) ? v : 0));
const shell: Shell = { tightness, bristle, color, softness };
const frameParam = params.get('frame');

const app = new Application();
await app.init({
  width: SIZE,
  height: SIZE,
  background: PAPER,
  preserveDrawingBuffer: true,
  antialias: true,
  autoStart: frameParam === null,
});
document.body.appendChild(app.canvas);

// ?pair=1 draws a second Pim behind and to the left, to check that bodies hide what is behind them.
const offsets = params.get('pair') === '1' ? [-SCALE * 0.3, SCALE * 0.15] : [0];
const views = offsets.map((dx) => {
  const view = createLineView(RigSchema.parse(pimJson), { ink: INK, accent: ACCENT, paper: PAPER }, SCALE);
  // The rig's base center is its origin and it is 1 unit tall: center it vertically.
  view.container.position.set(SIZE / 2 + dx, SIZE / 2 + SCALE / 2);
  app.stage.addChild(view.container);
  return view;
});
const draw = (seconds: number): void => {
  for (const view of views) view.update(shell, seconds, false, 0);
};

if (frameParam !== null) {
  draw((Number(frameParam) + 0.5) / BOIL_FPS);
  app.render();
} else {
  app.ticker.add(() => {
    draw(performance.now() / 1000);
  });
  draw(0);
}
document.body.dataset['ready'] = '1';
