// Strip: "Quick Meeting". Cap calls a five-minute meeting. Quill has one quick question, then more.
// The meeting runs all day, and Cap wants to do it again tomorrow.
import { bubble, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import {
  blinkAt,
  breathe,
  meadow,
  moon,
  shown,
  speech,
  startle,
  sun,
  sweat,
  twinkle,
  zzz,
} from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { cap, quill, pim, krit } = CAST;

const FY = 226;
/** Cap stands at the back; the others sit in a row in front. */
const CAP = 122;
const ROW = [
  { draw: pim, x: 36, size: 64 },
  { draw: krit, x: 98, size: 66 },
  { draw: quill, x: 186, size: 70 },
] as const;

type Mood = 'awake' | 'asleep' | 'shock';

/** Cap behind, three listeners in front. Quill is the one at the right. */
function room(ctx: Ctx, t: number, lt: number, mood: Mood, capPose = {}): void {
  cap(ctx, { x: CAP, y: FY - 34, size: 96, squash: breathe(t, 1.8), blink: blinkAt(t, 3.3), ...capPose }, t);
  ROW.forEach((c, i) => {
    const isQuill = i === 2;
    const sleep = mood === 'asleep' && !isQuill;
    c.draw(
      ctx,
      {
        x: c.x,
        y: FY + 18,
        size: c.size,
        flip: isQuill,
        squash: sleep
          ? 0.1 + breathe(t + i, 2.4, 0.04)
          : mood === 'shock'
            ? startle(lt, 1.6 + i * 0.08)
            : breathe(t + i),
        lean: sleep ? (i === 0 ? 0.2 : -0.15) : 0,
        blink: sleep ? 1 : blinkAt(t, 3, i),
        look: isQuill ? [0.04, 0.02] : [0.02, 0.03],
        shell: mood === 'shock' && !isQuill ? { tightness: 0.6, bristle: i === 1 ? 0.6 : 0 } : {},
      },
      t,
    );
    if (sleep) zzz(ctx, c.x + 10, FY - c.size + 10, t + i, 0.8);
    if (mood === 'shock' && !isQuill) sweat(ctx, c.x + c.size * 0.3, FY - c.size * 0.7, lt + i * 0.3, 1.3);
  });
}

mountStrip({
  id: 'quick-meeting',
  series: 'Meadow Life',
  title: 'Quick Meeting',
  label:
    'A four-panel comic. Panel 1, 9:00 in the morning: Cap says "Quick meeting! Five minutes." Pim, Krit, and Quill sit in front. ' +
    'Panel 2, 9:02: Quill says "Quick question." ' +
    'Panel 3, sunset: Quill says "And one more quick question." Pim and Krit are asleep. ' +
    'Panel 4, night: Cap says "Great meeting! Same time tomorrow?" Pim and Krit wake up in shock and sweat. ' +
    'Quill says "Quick question."',
  panels: [
    {
      caption: '9:00 AM',
      beat: 3.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        sun(ctx, 206, 54, 13, t);
        room(ctx, t, lt, 'awake', { squash: wobble(lt, 0.3, 0.2) });
        speech(ctx, 120, 58, 'Quick meeting! Five minutes.', CAP, FY - 120, shown(lt, 0.3, 99), 120);
      },
    },
    {
      caption: '9:02 AM',
      beat: 3.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        sun(ctx, 200, 52, 13, t);
        room(ctx, t, lt, 'awake');
        speech(ctx, 170, 112, 'Quick question.', 186, FY - 50, shown(lt, 0.4, 99), 110);
      },
    },
    {
      caption: '5:30 PM',
      beat: 4.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t, '#f6d7b8');
        sun(ctx, 40, FY - 18, 13, t);
        room(ctx, t, lt, lt > 0.6 ? 'asleep' : 'awake');
        speech(ctx, 168, 104, 'And one more quick question.', 186, FY - 50, shown(lt, 0.4, 99), 110);
      },
    },
    {
      caption: '9:00 PM',
      beat: 5,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t, '#3a4466');
        moon(ctx, 206, 62, 13);
        twinkle(ctx, 30, 70, t, 1);
        twinkle(ctx, 160, 50, t, 2);
        room(ctx, t, lt, lt > 1.6 ? 'shock' : 'asleep', { squash: wobble(lt, 0.3, 0.2) });
        speech(ctx, 106, 58, 'Great meeting! Same time tomorrow?', CAP, FY - 120, shown(lt, 0.3, 99), 130);
        speech(ctx, 176, 128, 'Quick question.', 186, FY - 50, shown(lt, 2.6, 99), 100, 14);
        for (const [i, c] of ROW.slice(0, 2).entries())
          bubble(ctx, c.x + 6, FY - c.size - 2, 'bang', shown(lt, 1.6 + i * 0.1, 99) * 0.55, [
            c.x,
            FY - c.size + 18,
          ]);
      },
    },
  ],
});
