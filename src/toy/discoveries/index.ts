import type { Discovery } from '../types.ts';
import { commons, standoff } from './game-theory.ts';
import { bridge, paradox, telephone } from './networks.ts';
import { identity, lever, shadows } from './philosophy.ts';
import { bystander, lookup, spotlight } from './psychology.ts';

/**
 * Every discovery, in the order the director checks them: the ones the player sets off on purpose
 * (a drop, a poke, a snip) come before the ones that wait for creatures to gather.
 */
export const DISCOVERIES: readonly Discovery[] = [
  bystander,
  identity,
  telephone,
  paradox,
  bridge,
  lever,
  shadows,
  spotlight,
  standoff,
  commons,
  lookup,
];
