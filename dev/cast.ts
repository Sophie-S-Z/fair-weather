// Dev page: the model sheet, every rig in content/rigs side by side at the same height, for art
// review. ?shell=t,b,c,s sets every shell; ?only=a,b draws only those rig ids.
import { Application, Text } from 'pixi.js';
import { RigSchema } from '../src/render/line/rig.ts';
import { createLineView } from '../src/render/line/line-view.ts';
import type { Shell } from '../src/sim/types.ts';

const CELL = 250;
const SCALE = 180;
const COLUMNS = 6;

const params = new URLSearchParams(location.search);
const [tightness = 0, bristle = 0, color = 0, softness = 0] = (params.get('shell') ?? '')
  .split(',')
  .map(Number)
  .map((v) => (Number.isFinite(v) ? v : 0));
const shell: Shell = { tightness, bristle, color, softness };
const only = params.get('only')?.split(',');

const files = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });
const rigs = Object.values(files)
  .map((json) => RigSchema.parse(json))
  .filter((rig) => !only || only.includes(rig.id))
  .sort((a, b) => a.id.localeCompare(b.id));

const app = new Application();
await app.init({
  width: CELL * Math.min(COLUMNS, rigs.length),
  height: CELL * Math.ceil(rigs.length / COLUMNS),
  background: 0xf5efe3,
  preserveDrawingBuffer: true,
  antialias: true,
  autoStart: false,
});
document.body.appendChild(app.canvas);
rigs.forEach((rig, i) => {
  const x = (i % COLUMNS) * CELL + CELL / 2;
  const y = Math.floor(i / COLUMNS) * CELL;
  const view = createLineView(rig, { ink: 0x2b2a28, accent: 0xf08a3c, paper: 0xfffdf8 }, SCALE);
  view.container.position.set(x, y + 20 + SCALE);
  view.update(shell, 0, true, 0);
  const label = new Text({ text: rig.id, style: { fontSize: 13, fill: 0x2b2a28 } });
  label.anchor.set(0.5, 0);
  label.position.set(x, y + CELL - 26);
  app.stage.addChild(view.container, label);
});
app.render();
document.body.dataset['ready'] = '1';
