// Meet Moss: sleepy. A leaf lands on Moss, Moss sneezes it off, and goes back to sleep.
import moss from '../../content/rigs/moss.rig.json';
import { COLOR, creature, easeIn, easeInOut, lerp, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawMoss = creature(moss);
const X = 230;
const SIZE = 100;
const TOP = FLOOR - SIZE * 0.96;
const SNEEZE = 3.9;

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.leaf;
  ctx.fill();
  ctx.moveTo(-21, 0);
  ctx.lineTo(21, 0);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

mount({
  id: 'meet-moss',
  tag: 'Meet Moss · sleepy',
  caption: 'Moss is very busy. Napping is hard work.',
  seconds: 6,
  still: 3.4,
  draw(ctx, t) {
    const breath = 0.035 * Math.sin((t / 2) * Math.PI * 2);
    const tickle = seg(t, 3.4, SNEEZE);
    const awake = seg(t, SNEEZE, SNEEZE + 0.1) * (1 - seg(t, 4.5, 4.9));

    drawMoss(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: SIZE,
        squash: breath - 0.12 * easeIn(tickle) * (t < SNEEZE ? 1 : 0) + wobble(t, SNEEZE, 0.3),
        blink: 1 - awake,
        look: [0, 0.03 * awake],
      },
      t,
    );

    // The leaf drifts down, sits on Moss, then flies off with the sneeze.
    const fall = seg(t, 1.0, 3.0);
    const fly = easeInOut(seg(t, SNEEZE, SNEEZE + 0.8));
    if (t > 1.0 && t < SNEEZE + 0.8) {
      const restX = X + 18;
      const x =
        t < SNEEZE ? lerp(340, restX, fall) + Math.sin(fall * 9) * 22 * (1 - fall) : lerp(restX, 60, fly);
      const y = t < SNEEZE ? lerp(-10, TOP - 4 - breath * SIZE, fall) : lerp(TOP - 4, -20, fly);
      leaf(ctx, x, y, t < SNEEZE ? Math.sin(fall * 9) * 0.6 * (1 - fall) + 0.2 : fly * 8);
    }

    // Each breath out lets a little z float up.
    ctx.fillStyle = COLOR.ink;
    ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++) {
      const u = ((t + k * 2) % 6) / 6;
      const quiet = t > 3.2 && t < 5.0;
      if (quiet) continue;
      ctx.globalAlpha = Math.sin(Math.PI * u) * 0.8;
      ctx.font = `bold ${String(12 + 14 * u)}px system-ui, sans-serif`;
      ctx.fillText('z', X + 70 + 60 * u, TOP + 10 - 110 * u);
    }
    ctx.globalAlpha = 1;
  },
});
