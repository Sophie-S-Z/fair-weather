// Checked by tsc (npm run typecheck), never run.
import type { BidReply, Command, Dials, SimEvent } from '../../../src/sim/types.ts';

export const commands: Command[] = [
  { t: 'shine', x: 1, y: 2 },
  { t: 'paintFog', x: 1, y: 2, r: 30, amount: 0.5 },
  { t: 'blow', x: 1, y: 2, dx: 1, dy: 0 },
  { t: 'place', kind: 'bench', x: 1, y: 2 },
  { t: 'place', kind: 'bush', x: 1, y: 2 },
  { t: 'place', kind: 'bridge', x: 1, y: 2 },
  { t: 'place', kind: 'lantern', x: 1, y: 2 },
  { t: 'thread', a: 'a', b: 'b', on: true },
  { t: 'whisper', target: 'a', about: 'b', sign: 1 },
  { t: 'respond', to: 'a', reply: 'toward' satisfies BidReply },
  { t: 'arrangeMeeting', a: 'a', b: 'b' },
  { t: 'setSeason', season: 'winter' },
];

// @ts-expect-error a shine command needs y
export const noY: Command = { t: 'shine', x: 1 };

// @ts-expect-error a path is not a placeable kind
export const path: Command = { t: 'place', kind: 'path', x: 1, y: 2 };

// @ts-expect-error Dials needs all five keys
export const noEar: Dials = { opener: 0, forgiveness: 0, memory: 0, wanderlust: 0 };

// @ts-expect-error an arrive event has no `to`
export const arrive: SimEvent = { t: 'arrive', who: 'a', to: 'b' };

export const okArrive: SimEvent = { t: 'arrive', who: 'a' };
