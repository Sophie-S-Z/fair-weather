// The Berry Committee, strip 1: "Turns". The meadow shares one berry bush and makes a fair rule.
// Gulp finds the loophole, and then everyone does. The adult layer: the office fridge, rules and loopholes.
import { bubble, bush, easeBack, easeInOut, hops, lerp, seg, wobble, arc, type Pose } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { berry, blinkAt, breathe, leafHat, meadow, shown, startle, sweat } from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, pose: Pose, t: number) => void;
const { cap, pim, krit, tove, gulp, nib, echo } = CAST;

const FY = 226;
/** Height of a creature in the queue. */
const Q = 62;

/** Where the berries hang on the bush, as offsets from its base. */
const BERRIES = [
  [-48, -26],
  [-20, -44],
  [8, -50],
  [34, -36],
  [56, -18],
  [-8, -22],
  [22, -16],
] as const;

/** The bush with its berries; `left` hides that many from the start of the list, for picked ones. */
function berryBush(ctx: Ctx, x: number, picked = 0): void {
  bush(ctx, x, FY);
  BERRIES.slice(picked).forEach(([dx, dy]) => {
    berry(ctx, x + dx, FY + dy, 5);
  });
}

/** A creature standing still in a line: it breathes and blinks on its own clock. */
function wait(draw: Draw, ctx: Ctx, t: number, pose: Pose): void {
  draw(ctx, { size: Q, squash: breathe(t, 2, 0.025), blink: blinkAt(t, 3.4, pose.x / 37), ...pose }, t);
}

/** The top of a creature's head, for a hat: its base less its drawn height. */
const head = (y: number, size: number, scale = 1): number => y - 0.97 * size * scale;

mountStrip({
  id: 'berry-committee-turns',
  series: 'The Berry Committee',
  title: 'Turns',
  label:
    'A four-panel comic. Panel 1: Cap stands by the berry bush and shouts the new rule, with one berry in its bubble. ' +
    'Caption: New rule: one berry each, in turn. ' +
    'Panel 2: A long queue waits at the bush. Gulp is first. It gets one berry and licks it up. ' +
    'Caption: The queue was very orderly. ' +
    'Panel 3: At the back of the queue stands Gulp again, now with a leaf on its head as a hat. It glances left and right and sweats. ' +
    'Tove turns and looks back at it, puzzled. Caption: Gulp joined the queue again. In a hat. ' +
    'Panel 4: The whole queue now wears leaf hats: Pim, Krit, Tove, and Gulp. Echo is last, and puts on its hat a beat late. ' +
    'Caption: Echo also wore a hat.',
  panels: [
    {
      caption: 'New rule: one berry each, in turn.',
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        berryBush(ctx, 66);
        // Cap puffs up and shouts. The rule pops out in its bubble.
        const shout = arc(seg(lt, 0.6, 1.0));
        cap(
          ctx,
          {
            x: 186,
            y: FY,
            size: 76,
            squash: -0.16 * shout + wobble(lt, 1.0, 0.18) + breathe(t),
            look: [-0.04, -0.01],
            shell: { color: 0.3 + 0.5 * shout },
            blink: blinkAt(t, 3.7),
          },
          t,
        );
        bubble(ctx, 172, FY - 132, 'bang', shown(lt, 0.6, 1.6) * 0.7, [178, FY - 104]);
        bubble(
          ctx,
          172,
          FY - 132,
          (c: Ctx) => {
            berry(c, 0, 3, 8);
          },
          shown(lt, 1.6, 99) * 0.8,
          [178, FY - 104],
        );
      },
    },
    {
      caption: 'The queue was very orderly.',
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        berryBush(ctx, -22, lt > 1.0 ? 1 : 0);
        // One berry flies from the bush to Gulp, and Gulp's tongue takes it.
        const fly = seg(lt, 1.0, 1.5);
        if (fly > 0 && fly < 1)
          berry(ctx, lerp(-70, 60, easeInOut(fly)), lerp(FY - 26, FY - 70, fly) - arc(fly) * 30, 5);
        const gulpIt = arc(seg(lt, 1.5, 1.75));
        if (gulpIt > 0) {
          ctx.beginPath();
          ctx.moveTo(74, FY - 40);
          ctx.lineTo(74 - 14 * gulpIt, FY - 40 - 36 * gulpIt);
          ctx.strokeStyle = '#d9475b';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        wait(gulp, ctx, t, {
          x: 74,
          y: FY,
          look: [-0.03, 0.03],
          squash: breathe(t) + wobble(lt, 1.75, 0.18),
        });
        wait(pim, ctx, t, { x: 138, y: FY, look: [-0.05, 0] });
        wait(krit, ctx, t, { x: 180, y: FY, look: [-0.05, 0], shell: { bristle: 0.3 } });
        wait(tove, ctx, t, { x: 224, y: FY, look: [-0.05, 0] });
        bubble(ctx, 80, FY - Q - 40, 'heart', shown(lt, 2.0, 99) * 0.6, [78, FY - Q - 14]);
      },
    },
    {
      caption: 'Gulp joined the queue again. In a hat.',
      beat: 5,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        // The back of the same queue. Gulp shuffles in and tries to look new.
        const come = hops(lt, 0.2, 1.0, w + 60, 196, 2);
        const glance = Math.sin(seg(lt, 1.6, 3.4) * Math.PI * 3) * 0.07;
        const tovePeek = seg(lt, 2.4, 2.6);
        wait(nib, ctx, t, { x: 26, y: FY, look: [-0.05, 0] });
        wait(tove, ctx, t, {
          x: 92,
          y: FY,
          flip: tovePeek > 0.5,
          look: [lerp(-0.05, 0.06, tovePeek), 0],
          squash: breathe(t) + startle(lt, 2.4),
          shell: { tightness: 0.4 * tovePeek },
        });
        const gy = FY - come.lift;
        wait(gulp, ctx, t, {
          x: come.x,
          y: gy,
          squash: come.squash,
          look: [glance, 0.01],
          shell: { tightness: 0.3 },
        });
        leafHat(ctx, come.x - 6, head(gy, Q, 1.05) + 6, 1.1);
        if (lt > 1.4) sweat(ctx, come.x + 36, FY - 46, lt, 1.3);
        bubble(ctx, 96, FY - Q - 46, 'question', shown(lt, 2.6, 99) * 0.6, [96, FY - Q - 20]);
      },
    },
    {
      caption: 'Echo also wore a hat.',
      beat: 4.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        const row: { draw: Draw; x: number; scale: number; top: number; shell?: Pose['shell'] }[] = [
          { draw: pim, x: 24, scale: 1, top: 0.97, shell: { color: 0.7 } },
          { draw: krit, x: 70, scale: 1, top: 0.82, shell: { bristle: 0.3 } },
          { draw: tove, x: 118, scale: 0.9, top: 0.97, shell: { tightness: 0.4 } },
          { draw: gulp, x: 174, scale: 1.05, top: 0.97 },
        ];
        for (const c of row) {
          wait(c.draw, ctx, t, { x: c.x, y: FY, look: [-0.05, 0], shell: c.shell ?? {} });
          leafHat(ctx, c.x, FY - c.top * Q * c.scale + 6, 0.8);
        }
        // Echo copies the row a beat late: it looks, then pops its own hat on.
        const hat = easeBack(seg(lt, 2.0, 2.3));
        wait(echo, ctx, t, {
          x: 226,
          y: FY,
          look: [-0.06, 0.01],
          squash: breathe(t) + wobble(lt, 2.3, 0.16),
        });
        if (hat > 0) leafHat(ctx, 226, FY - 0.97 * Q * 0.95 + 6 - 20 * (1 - hat), 0.8 * hat);
      },
    },
  ],
});
