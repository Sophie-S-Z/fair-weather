// Dev page: draws the Pim rig. ?shell=t,b,c,s sets the shell; ?frame=N renders boil frame N once.
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
  background: 0xffffff,
  preserveDrawingBuffer: true,
  antialias: true,
  autoStart: frameParam === null,
});
document.body.appendChild(app.canvas);

const view = createLineView(RigSchema.parse(pimJson), INK, ACCENT, SCALE);
// The rig's base center is its origin and it is 1 unit tall: center it vertically.
view.container.position.set(SIZE / 2, SIZE / 2 + SCALE / 2);
app.stage.addChild(view.container);

if (frameParam !== null) {
  view.update(shell, (Number(frameParam) + 0.5) / BOIL_FPS, false);
  app.render();
} else {
  app.ticker.add(() => {
    view.update(shell, performance.now() / 1000, false);
  });
  view.update(shell, 0, false);
}
document.body.dataset['ready'] = '1';
