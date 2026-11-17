// Meet Bell: vain. Bell admires itself in a mirror, until the reflection blinks on its own.
import bell from '../../content/rigs/bell.rig.json';
import { bubble, COLOR, creature, easeBack, easeInOut, seg } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawBell = creature(bell);
const BELL_X = 160;
const MX = 330;
const MY = FLOOR - 96;
const RX = 50;
const RY = 66;

mount({
  id: 'meet-bell',
  tag: 'Meet Bell · vain',
  caption: "Bell's biggest fan lives in the mirror.",
  seconds: 5.6,
  still: 3.2,
  draw(ctx, t) {
    // Bell sways and preens; the reflection copies, except for one blink.
    const sway = Math.sin((t / 1.4) * Math.PI * 2) * 0.06;
    const shock = seg(t, 2.9, 3.0) * (1 - seg(t, 4.0, 4.3));
    const peer = easeInOut(seg(t, 3.1, 3.5)) * (1 - easeInOut(seg(t, 3.9, 4.3)));
    const proud = 1 - shock;
    const pose = {
      size: 110,
      lean: sway * proud + peer * 0.15,
      squash: -0.1 * shock,
      shell: { color: 0.6 * proud, bristle: 0.3 * shock },
    };
    drawBell(ctx, { ...pose, x: BELL_X, y: FLOOR, look: [0.05, 0.01] }, t);

    // The mirror on its stand.
    ctx.beginPath();
    ctx.moveTo(MX, MY + RY);
    ctx.lineTo(MX, FLOOR);
    ctx.moveTo(MX - 22, FLOOR);
    ctx.lineTo(MX + 22, FLOOR);
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(MX, MY, RX, RY, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.glass;
    ctx.fill();
    ctx.clip();
    const wink = Math.sin(Math.PI * seg(t, 2.55, 2.85));
    drawBell(
      ctx,
      {
        ...pose,
        x: MX + 6,
        y: MY + RY * 0.95,
        size: 92,
        flip: true,
        lean: -pose.lean,
        look: [-0.05, 0.01],
        blink: wink,
      },
      t,
    );
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(MX, MY, RX, RY, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.stroke();

    bubble(ctx, BELL_X + 58, 76, 'heart', easeBack(seg(t, 0.4, 0.65)) * (1 - seg(t, 2.85, 2.95)), [
      BELL_X + 30,
      110,
    ]);
    bubble(ctx, BELL_X + 58, 76, 'question', easeBack(seg(t, 3.0, 3.2)) * (1 - seg(t, 4.0, 4.15)), [
      BELL_X + 30,
      110,
    ]);
    bubble(ctx, BELL_X + 58, 76, 'heart', easeBack(seg(t, 4.3, 4.55)) * (1 - seg(t, 5.3, 5.5)), [
      BELL_X + 30,
      110,
    ]);
  },
});
