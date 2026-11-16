// Rule cards (ADR 0015 item 8).
import { expect, test } from 'vitest';
import { cardGift, cardReply } from '../../../src/sim/cards.ts';
import { resolveMeeting } from '../../../src/sim/meeting.ts';
import type { RuleCard, SimEvent } from '../../../src/sim/types.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from './helpers.ts';

const pair = (cards: RuleCard[], berries = 3) =>
  makeWorld(
    [
      { id: 'a', x: 800, opener: 0.6, berries },
      { id: 'b', x: 810, opener: 0.4, berries },
    ],
    { cards },
  );

/** Seven draws that, with no card, give a toward reply and two gifts. */
const KIND = [0.5, 0, 0.99, 0, 0, 0.99, 0.99];

test('a reply card sets the reply when its state holds', () => {
  const w = pair([{ when: 'hungry', then: 'against' }], 0);
  expect(cardReply(w, get(w, 'b'), t)).toBe('against');
  const events = resolveMeeting(w, get(w, 'a'), get(w, 'b'), t, scriptedRng(KIND));
  expect(events.find((e): e is Extract<SimEvent, { t: 'bid' }> => e.t === 'bid')?.reply).toBe('against');
});

test('a gift card keeps or gives, and cannot give without the berries', () => {
  const keep = pair([{ when: 'full', then: 'keep' }], t.forage.carryMax);
  expect(cardGift(keep, get(keep, 'a'), t)).toBe('keep');
  const give = pair([{ when: 'hungry', then: 'give' }], 0);
  expect(cardGift(give, get(give, 'a'), t)).toBe('keep');
});

test('lonely and liked read friends now', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], {
    cards: [
      { when: 'liked', then: 'give' },
      { when: 'lonely', then: 'keep' },
    ],
  });
  expect(cardGift(w, get(w, 'a'), t)).toBe('keep');
  for (const o of ['b', 'c', 'd']) befriend(w, 'a', o);
  expect(cardGift(w, get(w, 'a'), t)).toBe('give');
});

test('the first card that matches wins, reply and gift cards apart', () => {
  const w = pair(
    [
      { when: 'hungry', then: 'keep' },
      { when: 'hungry', then: 'away' },
      { when: 'hungry', then: 'toward' },
    ],
    0,
  );
  expect(cardReply(w, get(w, 'b'), t)).toBe('away');
  expect(cardGift(w, get(w, 'b'), t)).toBe('keep');
});

test('cards take no draws: a meeting still takes exactly seven', () => {
  const w = pair([{ when: 'full', then: 'give' }]);
  const rng = scriptedRng(KIND);
  resolveMeeting(w, get(w, 'a'), get(w, 'b'), t, rng);
  expect(rng.used()).toBe(7);
});

test('a world without cards meets as before', () => {
  const w = pair([]);
  delete w.cards;
  expect(cardReply(w, get(w, 'a'), t)).toBeUndefined();
  expect(cardGift(w, get(w, 'a'), t)).toBeUndefined();
});
