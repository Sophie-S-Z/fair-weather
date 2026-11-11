/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { decaySlights, driftWarmth } from '../../../../src/sim/daily/drift.ts';
import { exp2neg } from '../../../../src/sim/math.ts';
import { resolveMeeting } from '../../../../src/sim/meeting.ts';
import { getTie } from '../../../../src/sim/world.ts';
import { befriend, get, makeWorld, scriptedRng, setWarmth, tuning as t } from '../helpers.ts';

test('drift: a tie with no meeting today moves 2% toward 0; a tie met today does not', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  w.day = 5;
  befriend(w, 'a', 'b', 0.5);
  setWarmth(w, 'a', 'c', -0.5);
  getTie(w, 'a', 'b')!.lastDay = 4;
  getTie(w, 'a', 'c')!.lastDay = 5;
  driftWarmth(w, t, scriptedRng([]));
  const ab = getTie(w, 'a', 'b')!;
  expect(ab.ab.warmth).toBeCloseTo(0.49, 12);
  expect(ab.ba.warmth).toBeCloseTo(0.49, 12);
  expect(getTie(w, 'a', 'c')!.ab.warmth).toBe(-0.5);
});

test('slights decay by exp2neg(1 / (1 + 29 x memory)) on each side, using that side owner Memory', () => {
  const w = makeWorld([
    { id: 'a', memory: 0.5 },
    { id: 'b', memory: 0 },
  ]);
  befriend(w, 'a', 'b');
  const tie = getTie(w, 'a', 'b')!;
  tie.ab.slights = 2;
  tie.ba.slights = 1;
  decaySlights(w, t, scriptedRng([]));
  expect(tie.ab.slights).toBe(2 * exp2neg(1 / (1 + 29 * 0.5)));
  expect(tie.ba.slights).toBe(exp2neg(1)); // half-life 1 day
});

test('grudger: Forgiveness 0, Memory 1, one slight still keeps after 30 dusks and gives after 31', () => {
  const run = (dusks: number) => {
    const w = makeWorld([
      { id: 'g', x: 800, opener: 0.6, forgiveness: 0, memory: 1, berries: 3 },
      { id: 'p', x: 810, opener: 0.4, berries: 3 },
    ]);
    befriend(w, 'g', 'p');
    const tie = getTie(w, 'g', 'p')!;
    tie.meetings = 1; // not a first meeting, so the give rule uses remembered slights
    tie.ab.slights = 1;
    for (let i = 0; i < dusks; i++) decaySlights(w, t, scriptedRng([]));
    // Draws: bidder, reply, reply fog, bidder gift (0: gives whenever allowed), replier gift, two gift fogs.
    const events = resolveMeeting(
      w,
      get(w, 'g'),
      get(w, 'p'),
      t,
      scriptedRng([0.5, 0.99, 0.99, 0, 0.99, 0.99, 0.99]),
    );
    return events.find((e) => e.t === 'gift' && e.from === 'g');
  };
  expect(run(30)).toMatchObject({ move: 'keep' });
  expect(run(31)).toMatchObject({ move: 'give' });
});
