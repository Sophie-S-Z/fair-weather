import { expect, test } from 'vitest';
import { parseBeatTag } from '../../../src/story/beat-tags.ts';

test.each([
  ['beat:arrange_meeting(krit,pim)', { arrange: ['krit', 'pim'] }],
  ['beat:arrange_meeting(villager-1,pim)', { arrange: ['villager-1', 'pim'] }],
  ['beat:camera(pim-close)', { camera: 'pim-close' }],
  ['beat:pause', { pause: true }],
  ['beat:open_bet', { openBet: true }],
  ['beat:prompt_sky_bid(pim)', { promptSkyBid: 'pim' }],
])('parseBeatTag reads %s', (tag, action) => {
  expect(parseBeatTag(tag)).toEqual(action);
});

test.each([
  'beat:arrange_meeting(krit)',
  'beat:drop_table()',
  'beat:arrange_meeting(Krit,pim)',
  'beat:camera()',
  'beat:pause()',
  'beat:open_bet(x)',
  'placeholder',
])('parseBeatTag rejects %s', (t) => {
  expect(parseBeatTag(t)).toBeNull();
});
