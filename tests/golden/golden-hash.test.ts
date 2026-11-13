import { expect, test } from 'vitest';
import commands from './m0-commands.json';
import golden from './m0-hash.json';
import { runGolden } from './run-golden.ts';
import { hashWorld } from '../../src/sim/hash.ts';
import type { Command } from '../../src/sim/types.ts';

// A new Command kind fails typecheck here until it is covered or listed in NotInM0.
// Later kinds stay out of the m0 list (that would change the stored hash); their own tests cover them.
type NotInM0 =
  'wake' | 'promptSkyBid' | 'overPoke' | 'dance' | 'walk' | 'manner' | 'plant' | 'local' | 'nudge';
const ALL = {
  shine: true,
  paintFog: true,
  blow: true,
  place: true,
  thread: true,
  whisper: true,
  respond: true,
  arrangeMeeting: true,
  setSeason: true,
} satisfies Record<Exclude<Command['t'], NotInM0>, true>;

test('the golden command list uses every Command kind', () => {
  const kinds = new Set(commands.map((c) => c.cmd.t));
  expect([...kinds].sort()).toEqual(Object.keys(ALL).sort());
});

test('golden: the m0 scenario with seed 1 and the fixed m0 command list gives the stored hash after 4,000 ticks', () => {
  expect(golden).toMatchObject({ seed: 1, ticks: 4000 });
  expect(hashWorld(runGolden())).toBe(golden.hash);
});
