import { drop, moveHeld, pickUp, poke, snip, toggleProp } from './commands.ts';
import { twinBoxes } from './geometry.ts';
import { prop, type TableSetup } from './table.ts';
import type { CastId, StickerId, Table } from './types.ts';

/** A small table that acts out one sentence of a lesson, with player actions at set times. */
export interface LoopSetup extends Omit<TableSetup, 'seed' | 'wander'> {
  seed?: number;
  cues?: readonly { at: number; act: (t: Table) => void }[];
}

/** One loop, or a few versions of it that a knob picks between. */
export interface LessonLoop {
  variants: readonly { label: string; setup: LoopSetup }[];
}

const one = (setup: LoopSetup): LessonLoop => ({ variants: [{ label: '', setup }] });

/** Drops `id` at (x, y), as the player would. */
const dropAt =
  (id: string, x: number, y: number) =>
  (t: Table): void => {
    pickUp(t, id);
    moveHeld(t, x, y);
    drop(t);
  };

const COOKIE = 640;
const cookiePair = (a: CastId, b: CastId, seed = 1, memory: TableSetup['memory'] = {}): LoopSetup => ({
  seed,
  cast: [
    [a, 680, COOKIE],
    [b, 920, COOKIE],
  ],
  props: [['cookie', 800, COOKIE]],
  memory,
});

const bushFour = (ties: TableSetup['ties'] = []): LoopSetup => ({
  cast: [
    ['frog', 640, 640],
    ['pim', 960, 640],
    ['krit', 690, 560],
    ['moss', 920, 560],
  ],
  props: [['bush', 800, 600]],
  ties,
});

const puddleWatch = (watchers: number): LoopSetup => {
  const crowd: CastId[] = ['krit', 'moss', 'bell', 'tove'];
  return {
    cast: [
      ['pim', 600, 640],
      ...crowd
        .slice(0, watchers)
        .map((id, i): [CastId, number, number] => [id, 920 + (i % 2) * 110, 560 + i * 50]),
    ],
    props: [['puddle', 760, 680]],
    cues: [{ at: 0.3, act: dropAt('pim', 760, 680) }],
  };
};

const track = (pull: boolean): LoopSetup => ({
  cast: [
    ['pim', 950, 545],
    ['krit', 1000, 650],
    ['quill', 650, 700],
  ],
  props: [['track', 800, 600]],
  cues: pull
    ? [
        {
          at: 0.1,
          act: (t) => {
            toggleProp(t, 'track');
          },
        },
      ]
    : [],
});

const ROW: readonly CastId[] = ['kite', 'pim', 'krit', 'moss', 'bell', 'tove'];
const chain = (length: number): LoopSetup => ({
  cast: ROW.slice(0, length).map((id, i): [CastId, number, number] => [
    id,
    560 + i * 110,
    600 + (i % 2) * 70,
  ]),
  ties: ROW.slice(0, length - 1).map((id, i): [CastId, CastId] => [id, ROW[i + 1] as CastId]),
  cues: [
    {
      at: 0.5,
      act: (t) => {
        poke(t, 'kite');
      },
    },
    {
      at: 0.7,
      act: (t) => {
        poke(t, 'kite');
      },
    },
  ],
});

const twoGroups = (cut: boolean): LoopSetup => ({
  cast: [
    ['pim', 520, 560],
    ['krit', 560, 700],
    ['moss', 680, 620],
    ['bell', 920, 620],
    ['tove', 1040, 560],
    ['snail', 1060, 700],
  ],
  ties: [
    ['pim', 'krit'],
    ['krit', 'moss'],
    ['pim', 'moss'],
    ['moss', 'bell'],
    ['bell', 'tove'],
    ['tove', 'snail'],
    ['bell', 'snail'],
  ],
  cues: cut ? [{ at: 1.2, act: (t) => snip(t, 'moss', 'bell') }] : [],
});

/** The loops beside each lesson sentence; null is a sentence with no loop. */
export const LESSON_LOOPS: Record<StickerId, readonly (LessonLoop | null)[]> = {
  standoff: [
    one(cookiePair('pim', 'glassling')),
    one(cookiePair('krit', 'pim')),
    {
      variants: [
        { label: 'Gulp', setup: cookiePair('krit', 'frog', 2) },
        { label: 'Kite', setup: cookiePair('krit', 'kite', 2) },
        { label: 'Pim', setup: cookiePair('krit', 'pim', 2) },
      ],
    },
  ],
  copycat: [
    one(cookiePair('echo', 'pim')),
    one(cookiePair('echo', 'krit', 1, { 'krit>echo': 'grab', 'echo>krit': 'grab' })),
    {
      variants: [
        { label: 'Pim', setup: cookiePair('echo', 'pim', 3, { 'pim>echo': 'share' }) },
        { label: 'Krit', setup: cookiePair('echo', 'krit', 3, { 'krit>echo': 'grab' }) },
        {
          label: 'Inch, after one slip',
          setup: {
            ...cookiePair('echo', 'snail', 3, { 'snail>echo': 'grab', 'echo>snail': 'grab' }),
            grudges: ['snail>echo'],
          },
        },
      ],
    },
  ],
  commons: [
    one(bushFour()),
    null,
    one(
      bushFour([
        ['frog', 'pim'],
        ['pim', 'krit'],
        ['krit', 'moss'],
      ]),
    ),
  ],
  lookup: [
    one({
      cast: [
        ['pim', 700, 600],
        ['krit', 780, 660],
        ['moss', 640, 680],
      ],
      props: [['signpost', 760, 560]],
    }),
    one({
      cast: [
        ['pim', 700, 600],
        ['krit', 780, 660],
        ['moss', 640, 680],
        ['tove', 1050, 640],
        ['bell', 1100, 560],
      ],
      props: [['signpost', 760, 560]],
    }),
    null,
  ],
  bystander: [
    one(puddleWatch(1)),
    {
      variants: [
        { label: '2', setup: puddleWatch(2) },
        { label: '3', setup: puddleWatch(3) },
        { label: '4', setup: puddleWatch(4) },
      ],
    },
    null,
  ],
  spotlight: [
    one({
      cast: [
        ['bell', 600, 640],
        ['pim', 860, 600],
        ['frog', 980, 680],
      ],
      props: [['mirror', 560, 620]],
      cues: [
        {
          at: 0.2,
          act: (t) => {
            poke(t, 'bell');
          },
        },
      ],
    }),
    null,
    null,
  ],
  identity: [
    one({
      cast: [
        ['glassling', 560, 660],
        ['quill', 1000, 560],
      ],
      props: [['twins', 800, 640]],
      cues: [
        {
          at: 0.4,
          act: (t) => {
            const p = prop(t, 'twins');
            if (p) dropAt('glassling', ...twinBoxes(p).a)(t);
          },
        },
      ],
    }),
    null,
    null,
  ],
  lever: [
    one(track(false)),
    {
      variants: [
        { label: 'Leave it', setup: track(false) },
        { label: 'Pull it', setup: track(true) },
      ],
    },
    null,
  ],
  shadows: [
    one({
      cast: [
        ['moss', 740, 600],
        ['pim', 860, 610],
        ['krit', 800, 760],
      ],
      props: [['lamp', 800, 660]],
      cues: [
        {
          at: 0.1,
          act: (t) => {
            toggleProp(t, 'lamp');
          },
        },
      ],
    }),
    null,
    null,
  ],
  telephone: [
    {
      variants: [
        { label: '4', setup: chain(4) },
        { label: '5', setup: chain(5) },
        { label: '6', setup: chain(6) },
      ],
    },
    null,
    null,
  ],
  bridge: [one(twoGroups(false)), one(twoGroups(true)), null],
  paradox: [
    one({
      cast: [
        ['pim', 560, 660],
        ['toadstool', 760, 620],
        ['krit', 900, 540],
        ['moss', 960, 660],
        ['bell', 860, 740],
        ['tove', 700, 500],
      ],
      ties: [
        ['pim', 'toadstool'],
        ['toadstool', 'krit'],
        ['toadstool', 'moss'],
        ['toadstool', 'bell'],
        ['toadstool', 'tove'],
      ],
      cues: [
        {
          at: 0.8,
          act: (t) => {
            poke(t, 'pim');
          },
        },
      ],
    }),
    null,
    null,
  ],
};

/** Seconds a loop may run with no scene before it starts again. */
export const LOOP_MAX = 16;
/** Seconds a loop holds its last pose after its scene ends. */
export const LOOP_HOLD = 1.5;
