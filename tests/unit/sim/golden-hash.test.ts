import { expect, test } from 'vitest';
import commands from '../../golden/m0-commands.json';
import golden from '../../golden/m0-hash.json';
import { runGolden } from '../../golden/run-golden.ts';
import { hashWorld } from '../../../src/sim/hash.ts';

test('the golden command list uses every Command kind', () => {
  const kinds = new Set(commands.map((c) => c.cmd.t));
  const all = [
    'shine',
    'paintFog',
    'blow',
    'place',
    'thread',
    'whisper',
    'respond',
    'arrangeMeeting',
    'setSeason',
  ];
  expect([...kinds].sort()).toEqual(all.sort());
});

test('golden: the m0 scenario with seed 1 and the fixed m0 command list gives the stored hash after 4,000 ticks', () => {
  expect(golden).toMatchObject({ seed: 1, ticks: 4000 });
  expect(hashWorld(runGolden())).toBe(golden.hash);
});
