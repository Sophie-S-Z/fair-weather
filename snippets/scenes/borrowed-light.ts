// Philosophy (Aquinas): things take part in a light they did not make, each in its own way.
import bell from '../../content/rigs/bell.rig.json';
import glassling from '../../content/rigs/glassling.rig.json';
import kite from '../../content/rigs/kite.rig.json';
import lantern from '../../content/rigs/lantern.rig.json';
import moss from '../../content/rigs/moss.rig.json';
import { COLOR, creature, easeInOut, easeOut, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawLantern = creature(lantern);
const LANTERN_X = 240;
const FRIENDS = [
  { draw: creature(glassling), x: 52 },
  { draw: creature(moss), x: 138 },
  { draw: creature(bell), x: 340 },
  { draw: creature(kite), x: 428 },
] as const;
const REACH = 220;
const GLOW_Y = FLOOR - 60;

mount({
  id: 'borrowed-light',
  tag: 'Philosophy · Aquinas',
  caption: 'Each one shines with a light it did not make.',
  seconds: 6.4,
  still: 3.4,
  draw(ctx, t) {
    // The lantern wakes, its light spreads out, holds, and pulls back in as it nods off.
    const awake = seg(t, 0.6, 0.8) * (1 - seg(t, 4.7, 5.0));
    const radius = REACH * (easeOut(seg(t, 0.8, 2.2)) - easeInOut(seg(t, 4.8, 5.8)));

    if (radius > 0) {
      const glow = ctx.createRadialGradient(LANTERN_X, GLOW_Y, 0, LANTERN_X, GLOW_Y, radius);
      glow.addColorStop(0, `${COLOR.glow}cc`);
      glow.addColorStop(0.8, `${COLOR.glow}55`);
      glow.addColorStop(1, `${COLOR.glow}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(LANTERN_X - radius, GLOW_Y - radius, radius * 2, radius * 2);
    }

    const sway = Math.sin(t * 2.4) * 0.05 * seg(t, 2.4, 2.8) * (1 - seg(t, 4.4, 4.8));
    for (const f of FRIENDS) {
      const reach = Math.abs(f.x - LANTERN_X) / REACH;
      const lit = seg(radius / REACH, reach - 0.08, reach + 0.04);
      const lightAt = 0.8 + 1.4 * easeOut(reach);
      const toward = Math.sign(LANTERN_X - f.x);
      f.draw(
        ctx,
        {
          x: f.x,
          y: FLOOR,
          size: 78,
          gray: 1 - lit,
          squash: wobble(t, lightAt, 0.2),
          lean: sway * toward,
          look: [0.04 * toward * lit, 0.02 * lit],
          shell: { softness: 0.3 + 0.5 * lit },
        },
        t,
      );
    }
    drawLantern(
      ctx,
      {
        x: LANTERN_X,
        y: FLOOR,
        size: 104,
        blink: 1 - awake,
        squash: wobble(t, 0.7, 0.25),
        fill: awake > 0.5 ? COLOR.glow : COLOR.paper,
      },
      t,
    );
  },
});
