import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { describe, expect, test } from 'vitest';
import ch0Json from '../../../content/chapters/ch0.json';
import ch1Json from '../../../content/chapters/ch1.json';
import ch2Json from '../../../content/chapters/ch2.json';
import ch3Json from '../../../content/chapters/ch3.json';
import ch9Json from '../../../content/chapters/ch9.json';
import flagsJson from '../../../content/flags.json';
import tuningJson from '../../../content/tuning.json';
import { hashWorld } from '../../../src/sim/hash.ts';
import { step } from '../../../src/sim/step.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Command, Scenario, SimEvent, World } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';
import type { FromWorker, SimPort, ToWorker, WorldLite } from '../../../src/sim-host/protocol.ts';
import {
  assertStoryCommand,
  createChapterRunner,
  STORY_COMMANDS,
} from '../../../src/story/chapter-runner.ts';
import type { ChapterRunner, Prompt } from '../../../src/story/chapter-runner.ts';
import { FLAG_KEYS, parseFlags } from '../../../src/story/flags.ts';
import type { Flags } from '../../../src/story/flags.ts';
import { createInk } from '../../../src/story/ink.ts';
import type { InkRunner } from '../../../src/story/ink.ts';
import type { VerbInput } from '../../../src/story/verbs.ts';
import { buildScenario } from '../../../src/story/scenario.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import type { Chapter } from '../../../src/story/schema.ts';
import ch9Carry from '../../golden/carry/ch9.json';
import { runChapterHeadless } from '../../golden/run-chapter.ts';
import { manualClock } from '../sim-host/harness.ts';

const ch0 = ChapterSchema.parse(ch0Json);
const ch1 = ChapterSchema.parse(ch1Json);
// The runner tests count ticks from fixed beat times (the bet at 10 s, the arrange at 20 s), so
// they pin those times instead of following ch2's tuning in content.
const ch2Content = ChapterSchema.parse(ch2Json);
const ch2: Chapter = {
  ...ch2Content,
  beats: ch2Content.beats.map((b) =>
    b.id === 'open_bet'
      ? { ...b, trigger: { at: 10 } }
      : b.id === 'arrange_krit_pim'
        ? { ...b, trigger: { at: 20 } }
        : b,
  ),
};
const ch3 = ChapterSchema.parse(ch3Json);
/** ch0 with its first_wake beat on the wake verb, for the tests of verb-triggered beats. */
const ch0ByVerb: Chapter = {
  ...ch0,
  beats: ch0.beats.map((b) => (b.id === 'first_wake' ? { ...b, trigger: { verb: 'wake' } } : b)),
};

// Ticks: sim.stepsPerSecond is 10. ch0 and ch1 days are 600 ticks; ch2 and ch3 days are 450.
const defaults = parseFlags(flagsJson);
const flags: Flags = {
  ...defaults,
  pimSkyBond: 0.9,
  pimSkyOpinion: -1,
  pimScar: true,
  benchPlaced: false,
  friendThreads: 0,
};

// Ink variables mirror the flags (spec 10.3), so every story declares them.
const FLAG_VARS = FLAG_KEYS.map((k) => `VAR ${k} = ${String(defaults[k])}`).join('\n');
const VARS = `${FLAG_VARS}\nVAR pim_sky_warmth = 0`;

function compile(source: string): string {
  return new Compiler(`${VARS}\n${source}`).Compile().ToJson() ?? '';
}

/** An Ink story with one line per knot (text `<knot> line.` unless given), recording plays. */
function inkOf(knots: string[], extra: Record<string, string> = {}): InkRunner & { played: string[] } {
  const src = knots.map((k) => `=== ${k} ===\n${extra[k] ?? `${k} line.`}\n-> END\n`).join('');
  const ink = createInk(compile(src));
  const played: string[] = [];
  return {
    played,
    setVar: (n, v) => {
      ink.setVar(n, v);
    },
    state: () => ink.state(),
    load: (st) => {
      ink.load(st);
    },
    play: (k) => {
      played.push(k);
      return ink.play(k);
    },
  };
}
const CH0_KNOTS = ['ch0_dawn', 'ch0_pim_wakes', 'ch0_pim_looks_up', 'ch0_close_call'];
const CH1_KNOTS = ['ch1_wave', 'ch1_reply'];
const CH2_KNOTS = ['ch2_intro', 'ch2_bet', 'ch2_exploit', 'ch2_close_call'];
const CH3_KNOTS = ['ch3_intro', 'ch3_bench', 'ch3_warm', 'ch3_close_call'];

const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
function lite(
  o: {
    berries?: Record<string, number>;
    pimSky?: number;
    metrics?: WorldLite['metrics'];
    bench?: boolean;
    structures?: WorldLite['structures'];
    /** Fields that differ from the default creature, by id. */
    patch?: Record<string, Partial<WorldLite['creatures'][number]>>;
  } = {},
): WorldLite {
  const berries = o.berries ?? { pim: 1, krit: 1 };
  return {
    creatures: Object.entries(berries).map(([id, b]) => ({
      id,
      speciesId: 'kith',
      x: 0,
      y: 0,
      state: 'wander' as const,
      shell,
      berries: b,
      skyWarmth: id === 'pim' ? (o.pimSky ?? 0) : 0,
      dancing: false,
      gone: false,
      dials,
      ...o.patch?.[id],
    })),
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: o.metrics ?? { averageWarmth: 0, friendPairs: 0 },
    structures: o.structures ?? (o.bench ? [{ id: 'bench-1', kind: 'bench', x: 10, y: 10 }] : []),
    water: [],
    banks: [],
    decks: [],
    islets: [],
    mushroom: null,
    bushes: [],
    ties: [],
    rumor: null,
    hero: null,
  };
}

/**
 * A SimPort the test drives. `step` posts one step the way the worker does: `accepted` for the
 * commands sent since the last step, `events` at tick T, then `snapshot` at T + 1.
 */
function fakePort(): {
  port: SimPort;
  sent: { tick: number; cmd: Command }[];
  speeds: number[];
  push(m: FromWorker): void;
  step(events?: SimEvent[], l?: WorldLite): void;
  steps(n: number, l?: WorldLite): void;
} {
  const listeners = new Set<(m: FromWorker) => void>();
  const sent: { tick: number; cmd: Command }[] = [];
  const speeds: number[] = [];
  let queued: Command[] = [];
  let tick = 0;
  const push = (m: FromWorker): void => {
    for (const cb of [...listeners]) cb(m);
  };
  const port: SimPort = {
    send(list) {
      for (const cmd of list) sent.push({ tick, cmd });
      queued.push(...list);
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed(m) {
      speeds.push(m);
    },
    requestHash: () => Promise.reject(new Error('no hash')),
  };
  const stepOnce = (events: SimEvent[] = [], l: WorldLite = lite()): void => {
    if (queued.length > 0) push({ t: 'accepted', tick, list: queued });
    queued = [];
    push({ t: 'events', tick, list: events });
    tick += 1;
    push({ t: 'snapshot', tick, lite: l });
  };
  return {
    port,
    sent,
    speeds,
    push,
    step: stepOnce,
    steps(n, l) {
      for (let i = 0; i < n; i++) stepOnce([], l);
    },
  };
}

function record(runner: ChapterRunner): Prompt[] {
  const prompts: Prompt[] = [];
  runner.onPrompt((p) => prompts.push(p));
  return prompts;
}
const lines = (ps: Prompt[]): string[] => ps.flatMap((p) => (p.kind === 'line' ? [p.text] : []));
const cmds = (f: ReturnType<typeof fakePort>): Command[] => f.sent.map((s) => s.cmd);
const gift = (from: string, to: string, move: 'give' | 'keep'): SimEvent => ({
  t: 'gift',
  from,
  to,
  move,
  seenAs: move,
});
const settled = async (p: Promise<unknown>): Promise<boolean> => {
  let done = false;
  void p.then(
    () => (done = true),
    () => (done = true),
  );
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('verbs', () => {
  test('a locked verb returns false and sends nothing', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    f.step();
    expect(runner.verb({ verb: 'place', x: 100, y: 100 })).toBe(false);
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(false);
    expect(f.sent).toEqual([]);
    expect(runner.log.filter((e) => e.kind === 'verb')).toEqual([]);
  });

  test('an unlocked verb sends its command, fires its beat once, and is logged', () => {
    const f = fakePort();
    const ink = inkOf(CH0_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch0ByVerb, flags);
    const shots: string[] = [];
    runner.onCamera((s) => shots.push(s));
    f.step();
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(true);
    expect(runner.verb({ verb: 'wake', who: 'krit' })).toBe(true);
    expect(cmds(f)).toEqual([
      { t: 'wake', who: 'pim' },
      { t: 'promptSkyBid', who: 'pim' }, // the first_wake beat
      { t: 'wake', who: 'krit' },
    ]);
    expect(ink.played).toEqual(['ch0_dawn', 'ch0_pim_wakes']);
    expect(shots).toEqual(['meadow-wide', 'pim-close']);
    expect(runner.log.filter((e) => e.kind === 'verb')).toEqual([
      { kind: 'verb', tick: 1, input: { verb: 'wake', who: 'pim' } },
      { kind: 'verb', tick: 1, input: { verb: 'wake', who: 'krit' } },
    ]);
  });

  test('respond with no sky bid to answer returns false and sends nothing', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH1_KNOTS), ch1, flags);
    f.step();
    expect(cmds(f)).toEqual([{ t: 'promptSkyBid', who: 'pim' }]); // the wave beat
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(false);
    expect(cmds(f)).toEqual([{ t: 'promptSkyBid', who: 'pim' }]);
  });

  test('a skip inside a beat stops the rest of the beat, and the verb reports false', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0ByVerb, flags);
    const shots: string[] = [];
    runner.onCamera((s) => shots.push(s));
    runner.onPrompt((p) => {
      if (p.kind === 'line' && p.text === 'ch0_pim_wakes line.') runner.skip();
    });
    f.step();
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(false);
    expect(cmds(f)).toEqual([{ t: 'wake', who: 'pim' }]); // no promptSkyBid after the skip
    expect(shots).toEqual(['meadow-wide']); // no pim-close
    await expect(runner.done).resolves.toEqual({ ...flags, pimSkyBond: 0.5 });
  });

  test("ch0's first_wake beat waits for the sim's wake event for Pim, not the verb", () => {
    const f = fakePort();
    const ink = inkOf(CH0_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch0, flags);
    f.step();
    expect(runner.verb({ verb: 'wake', who: 'krit' })).toBe(true);
    f.step([{ t: 'wake', who: 'krit' }]);
    expect(ink.played).toEqual(['ch0_dawn']); // waking Krit tells nothing about Pim
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(true);
    expect(ink.played).toEqual(['ch0_dawn']); // the sim has not woken Pim yet
    f.step([{ t: 'wake', who: 'pim' }]);
    expect(ink.played).toEqual(['ch0_dawn', 'ch0_pim_wakes']);
    expect(cmds(f)).toEqual([
      { t: 'wake', who: 'krit' },
      { t: 'wake', who: 'pim' },
      { t: 'promptSkyBid', who: 'pim' },
    ]);
  });

  test('place works once per chapter (spec 6.2: one bench); the second returns false and sends nothing', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), ch3, flags);
    f.step();
    expect(runner.verb({ verb: 'place', x: 100, y: 100 })).toBe(true);
    expect(runner.verb({ verb: 'place', x: 200, y: 100 })).toBe(false);
    expect(cmds(f).filter((c) => c.t === 'place')).toEqual([{ t: 'place', kind: 'bench', x: 100, y: 100 }]);
  });

  test('a verb before the first snapshot returns false', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(false);
    expect(f.sent).toEqual([]);
  });
});

describe('Part 1 verbs', () => {
  /** ch0 with three Part 1 world verbs and no beats, so only the verbs send commands. */
  const worldVerbs: Chapter = {
    ...ch0,
    verbs: ['shine', 'fog', 'thread'],
    newVerb: null,
    beats: [],
    exit: { afterDays: 10 },
  };

  test.each([
    [
      { verb: 'shine', x: 10, y: 20 },
      { t: 'shine', x: 10, y: 20 },
    ],
    [
      { verb: 'fog', x: 1, y: 2, clear: true },
      { t: 'paintFog', x: 1, y: 2, r: 120, amount: -0.3 },
    ],
    [
      { verb: 'fog', x: 1, y: 2, clear: false },
      { t: 'paintFog', x: 1, y: 2, r: 120, amount: 0.3 },
    ],
    [
      { verb: 'thread', a: 'pim', b: 'echo', on: false },
      { t: 'thread', a: 'pim', b: 'echo', on: false },
    ],
  ] satisfies [VerbInput, Command][])('verb %o sends %o', (input, command) => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf([]), worldVerbs, flags);
    f.step();
    expect(runner.verb(input)).toBe(true);
    expect(cmds(f)).toEqual([command]);
  });

  test('whisper and blow send their commands', () => {
    const f = fakePort();
    const chapter: Chapter = { ...worldVerbs, verbs: ['whisper', 'blow'] };
    const runner = createChapterRunner(f.port, inkOf([]), chapter, flags);
    f.step();
    expect(runner.verb({ verb: 'whisper', target: 'echo', about: 'krit', sign: -1 })).toBe(true);
    expect(runner.verb({ verb: 'blow', x: 1, y: 2, dx: 3, dy: 4 })).toBe(true);
    expect(cmds(f)).toEqual([
      { t: 'whisper', target: 'echo', about: 'krit', sign: -1 },
      { t: 'blow', x: 1, y: 2, dx: 3, dy: 4 },
    ]);
  });

  test('place sends the chapter kind and stops at its limit', () => {
    const f = fakePort();
    const chapter: Chapter = { ...ch3, place: { kind: 'bridge', limit: 2 } };
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), chapter, flags);
    f.step();
    expect(runner.verb({ verb: 'place', x: 100, y: 100 })).toBe(true);
    expect(runner.verb({ verb: 'place', x: 200, y: 100 })).toBe(true);
    expect(runner.verb({ verb: 'place', x: 300, y: 100 })).toBe(false);
    expect(cmds(f).filter((c) => c.t === 'place')).toEqual([
      { t: 'place', kind: 'bridge', x: 100, y: 100 },
      { t: 'place', kind: 'bridge', x: 200, y: 100 },
    ]);
  });

  test('a beat rumor sends one whisper; a beat dance sends one dance', () => {
    const f = fakePort();
    const chapter: Chapter = {
      ...worldVerbs,
      beats: [
        {
          id: 'festival',
          trigger: { at: 0 },
          actions: [{ rumor: { target: 'echo', about: 'krit', sign: 1 } }, { dance: 'pim' }],
        },
      ],
    };
    createChapterRunner(f.port, inkOf([]), chapter, flags);
    f.steps(20);
    expect(cmds(f)).toEqual([
      { t: 'whisper', target: 'echo', about: 'krit', sign: 1 },
      { t: 'dance', who: 'pim' },
    ]);
  });
});

describe('focus', () => {
  test('a focus action goes to the focus listeners, in beat order', () => {
    const f = fakePort();
    // Pinned: ch0 also focuses Pim at dawn, which would fire on the first step.
    const wakeOnly: Chapter = {
      ...ch0,
      beats: ch0.beats.map((b) => ({
        ...b,
        actions: b.id === 'dawn' ? b.actions.filter((a) => !('focus' in a)) : b.actions,
      })),
    };
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), wakeOnly, flags);
    const got: (string | null)[] = [];
    const off = runner.onFocus((id) => got.push(id));
    f.step();
    expect(got).toEqual([]);
    runner.verb({ verb: 'wake', who: 'krit' });
    f.step([{ t: 'wake', who: 'krit' }]);
    expect(got).toEqual([]);
    f.step([{ t: 'wake', who: 'pim' }]);
    expect(got).toEqual(['pim']);
    off();
    const cleared = { id: 'x', trigger: { at: 0 }, actions: [{ focus: null }] };
    expect(() => ChapterSchema.parse({ ...ch0, beats: [...ch0.beats, cleared] })).not.toThrow();
  });

  test('ch0 focuses Pim from its first beat', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    const got: (string | null)[] = [];
    runner.onFocus((id) => got.push(id));
    f.step();
    expect(got).toEqual(['pim']);
  });
});

describe('over-poke', () => {
  test('overPoke sends the overPoke command once a snapshot has arrived, and never after the end', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    runner.overPoke();
    expect(f.sent).toEqual([]);
    f.step();
    runner.overPoke();
    expect(cmds(f)).toEqual([{ t: 'overPoke' }]);
    runner.skip();
    runner.overPoke();
    expect(cmds(f)).toEqual([{ t: 'overPoke' }]);
  });
});

describe('sky bids', () => {
  test('the player answers a sky bid; an unanswered one gets away after 6 sim seconds', () => {
    const f = fakePort();
    const open: Chapter = { ...ch1, exit: { afterDays: 10 } }; // ch1 itself ends on the first reply
    const runner = createChapterRunner(f.port, inkOf(CH1_KNOTS), open, flags);
    const responds = (): Command[] => cmds(f).filter((c) => c.t === 'respond');
    f.step([{ t: 'skyBid', who: 'pim' }]); // events tick 0
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(true);
    f.steps(3);
    f.step([{ t: 'skyBid', who: 'pim' }]); // events tick 4: the reply is due at tick 64
    f.steps(58); // snapshot tick 63
    expect(responds()).toEqual([{ t: 'respond', to: 'pim', reply: 'toward' }]);
    f.step(); // snapshot tick 64
    expect(responds()).toEqual([
      { t: 'respond', to: 'pim', reply: 'toward' },
      { t: 'respond', to: 'pim', reply: 'away' },
    ]);
    f.steps(100);
    expect(responds()).toHaveLength(2);
  });

  test('after the automatic away, the same creature bids again 4 sim seconds later, so a slow player can still answer', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH1_KNOTS), ch1, flags);
    f.step(); // snapshot tick 1: the wave beat prompts Pim's bid
    expect(cmds(f)).toEqual([{ t: 'promptSkyBid', who: 'pim' }]);
    f.step([{ t: 'skyBid', who: 'pim' }]); // events tick 1: away is due at tick 61
    f.steps(59); // snapshot tick 61
    expect(cmds(f).slice(1)).toEqual([{ t: 'respond', to: 'pim', reply: 'away' }]);
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(false);
    f.steps(39); // snapshot tick 100
    expect(cmds(f)).toHaveLength(2);
    f.step(); // snapshot tick 101 = 61 + 40
    expect(cmds(f).slice(2)).toEqual([{ t: 'promptSkyBid', who: 'pim' }]);
    f.step([{ t: 'skyBid', who: 'pim' }]);
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(true);
    f.step();
    expect(await settled(runner.done)).toBe(true);
    expect(cmds(f).slice(3)).toEqual([{ t: 'respond', to: 'pim', reply: 'toward' }]);
  });

  test('an ambient sky bid gets away after 6 s and is not prompted again', () => {
    const f = fakePort();
    createChapterRunner(f.port, inkOf(CH1_KNOTS), { ...ch1, exit: { afterDays: 10 } }, flags);
    f.step(); // snapshot tick 1: the wave beat prompts Pim's bid
    f.step([{ t: 'skyBid', who: 'krit', ambient: true }]); // events tick 1: away is due at tick 61
    f.steps(200);
    expect(f.sent).toEqual([
      { tick: 1, cmd: { t: 'promptSkyBid', who: 'pim' } },
      { tick: 61, cmd: { t: 'respond', to: 'krit', reply: 'away' } },
    ]);
  });

  test("chapter 1 ends on the snapshot after the first reply, with Pim's opinion from its sky warmth", async () => {
    const f = fakePort();
    const ink = inkOf(CH1_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch1, flags);
    f.step([], lite({ pimSky: -0.02 }));
    f.step([{ t: 'skyBid', who: 'pim' }], lite({ pimSky: -0.02 }));
    f.step([{ t: 'opinion', holder: 'pim', about: 'krit', value: 0.4 }], lite({ pimSky: -0.02 }));
    expect(await settled(runner.done)).toBe(false); // an opinion about a creature does not end it
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(true);
    expect(ink.played).toEqual(['ch1_wave', 'ch1_reply']);
    expect(await settled(runner.done)).toBe(false); // the reply is not applied yet
    f.step([], lite({ pimSky: 0.08 }));
    await expect(runner.done).resolves.toEqual({ ...flags, pimSkyOpinion: 1 });
  });

  test('a snapshot posted before the worker accepted the reply does not end the chapter', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH1_KNOTS), ch1, flags);
    f.step();
    f.step([{ t: 'skyBid', who: 'pim' }]);
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(true);
    // A stale snapshot: the worker stepped before the reply reached it, so no `accepted` yet.
    f.push({ t: 'snapshot', tick: 3, lite: lite({ pimSky: 0 }) });
    expect(await settled(runner.done)).toBe(false);
    f.step([], lite({ pimSky: 0.1 })); // accepted for tick 2, then the snapshot after that step
    await expect(runner.done).resolves.toEqual({ ...flags, pimSkyOpinion: 1 });
  });
});

describe('beats', () => {
  test('a time beat fires once at its tick', () => {
    const f = fakePort();
    const ink = inkOf(CH2_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch2, flags);
    const prompts = record(runner);
    f.step(); // chapter time 0 is tick 0, the first step
    expect(lines(prompts)).toEqual(['ch2_intro line.']);
    f.steps(98); // tick 99
    expect(prompts.filter((p) => p.kind === 'bet')).toEqual([]);
    f.step(); // tick 100: 10 s in
    expect(prompts.filter((p) => p.kind === 'bet')).toEqual([
      { kind: 'bet', question: 'ch2_bet line.', options: ['pim', 'krit', 'echo', 'moss', 'bell', 'wisp'] },
    ]);
    f.steps(99); // tick 199
    expect(f.sent).toEqual([]);
    f.step(); // tick 200: 20 s in
    expect(f.sent).toEqual([{ tick: 200, cmd: { t: 'arrangeMeeting', a: 'krit', b: 'pim' } }]);
    f.steps(500);
    expect(prompts.filter((p) => p.kind === 'bet')).toHaveLength(1);
    expect(f.sent).toHaveLength(1);
    expect(ink.played).toEqual(['ch2_intro', 'ch2_bet']);
    expect(f.speeds).toEqual([1, 0]); // start, then openBet's pause
  });

  test('an event beat fires on the matching event and an onBeat exit resolves done', async () => {
    const f = fakePort();
    const ink = inkOf(CH0_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch0, flags);
    const prompts = record(runner);
    f.step([], lite({ pimSky: 0.25 }));
    f.step([{ t: 'skyBid', who: 'krit' }], lite({ pimSky: 0.25 }));
    expect(ink.played).toEqual(['ch0_dawn']);
    expect(await settled(runner.done)).toBe(false);
    f.step([{ t: 'skyBid', who: 'pim' }], lite({ pimSky: 0.25 }));
    expect(ink.played).toEqual(['ch0_dawn', 'ch0_pim_looks_up']);
    expect(lines(prompts)).toEqual(['ch0_dawn line.', 'ch0_pim_looks_up line.']);
    expect(f.speeds).toEqual([1, 0]);
    await expect(runner.done).resolves.toEqual({ ...flags, pimSkyBond: 0.625 }); // (0.25 + 1) / 2
  });

  // Honesty: ch9 sends Pim's dance at 40 s, but the sim dances only a creature still here. The line
  // that says Pim dances waits for the sim's dance event, so a year where Pim went over the ridge or
  // away hungry never hears it.
  test.each([
    ['here', false],
    ['gone', true],
  ])("ch9's seed line plays only on the sim's dance event for Pim (Pim %s)", async (_, gone) => {
    const ch9 = ChapterSchema.parse(ch9Json);
    const carry = structuredClone(ch9Carry);
    for (const c of carry.creatures) if (c.id === 'pim' && gone) Object.assign(c, { away: true, gone: true });
    const said: string[] = [];
    const player = { onPrompt: (p: Prompt) => p.kind === 'line' && said.push(p.text) };
    // 45 s of chapter time: the seed beat runs at 40 s.
    const run = await runChapterHeadless(ch9, 1, player, defaults, 450, carry);
    const seed = run.log.find(
      (e) => e.kind === 'accepted' && e.list.some((c) => c.t === 'dance' && c.who === 'pim'),
    );
    expect(seed).toBeDefined(); // the story asked in both years
    const danced = run.log.some((e) => e.kind === 'event' && e.e.t === 'dance' && e.e.who === 'pim');
    expect(danced).toBe(!gone);
    expect(said.some((l) => l.includes('Pim starts to dance'))).toBe(!gone);
  });

  test('events before the first snapshot wait for it', async () => {
    const f = fakePort();
    const ink = inkOf(CH0_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch0, flags);
    f.push({ t: 'events', tick: 0, list: [{ t: 'skyBid', who: 'pim' }] });
    expect(ink.played).toEqual([]);
    expect(await settled(runner.done)).toBe(false);
    f.push({ t: 'snapshot', tick: 1, lite: lite({ pimSky: 0.3 }) });
    expect(ink.played).toEqual(['ch0_dawn', 'ch0_pim_looks_up']);
    await expect(runner.done).resolves.toEqual({ ...flags, pimSkyBond: 0.65 });
  });

  test('an unknown beat tag rejects done and sends nothing, even after a good tag', async () => {
    const f = fakePort();
    const ink = inkOf(CH0_KNOTS, {
      ch0_dawn: 'A. #beat:arrange_meeting(krit,pim)\nB. #beat:drop_table()',
    });
    const runner = createChapterRunner(f.port, ink, ch0, flags);
    f.step();
    await expect(runner.done).rejects.toThrow('beat:drop_table()');
    expect(f.sent).toEqual([]);
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(false);
  });

  test('unsubscribed prompt and camera listeners hear nothing more', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    const prompts: Prompt[] = [];
    const shots: string[] = [];
    const offPrompt = runner.onPrompt((p) => prompts.push(p));
    const offCamera = runner.onCamera((s) => shots.push(s));
    f.step();
    offPrompt();
    offCamera();
    runner.verb({ verb: 'wake', who: 'pim' });
    expect(lines(prompts)).toEqual(['ch0_dawn line.']);
    expect(shots).toEqual(['meadow-wide']);
  });
});

describe('bets', () => {
  test('a bet sets speed 8, waits afterDays, measures, sets speed 1, and logs answer and result', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH2_KNOTS), ch2, flags);
    const prompts = record(runner);
    f.steps(100); // the bet opens at tick 100
    runner.answerBet('nobody'); // not an option: ignored
    expect(f.speeds).toEqual([1, 0]);
    runner.answerBet('pim');
    expect(f.speeds).toEqual([1, 0, 8]);
    runner.answerBet('krit'); // an answer is already in: ignored
    expect(f.speeds).toEqual([1, 0, 8]);
    const kritWins = lite({ berries: { pim: 2, krit: 5, echo: 3 } });
    f.steps(3149, kritWins); // tick 3249: 7 days of 450 ticks is 3150
    expect(prompts.filter((p) => p.kind === 'reveal')).toEqual([]);
    expect(f.speeds).toEqual([1, 0, 8]);
    f.step([], kritWins); // tick 3250
    expect(f.speeds).toEqual([1, 0, 8, 1]);
    expect(prompts.filter((p) => p.kind === 'reveal')).toEqual([
      { kind: 'reveal', answer: 'pim', result: 'krit' },
    ]);
    expect(runner.log.filter((e) => e.kind === 'bet')).toEqual([
      { kind: 'bet', tick: 3250, id: 'ch2_most_berries', answer: 'pim', result: 'krit' },
    ]);
    runner.answerBet('krit'); // the bet is over
    expect(f.speeds).toEqual([1, 0, 8, 1]);
  });

  test('a bucket bet reveals the option whose bucket holds the measured value', () => {
    const f = fakePort();
    const awayBet: Chapter = {
      ...ch2,
      bet: {
        id: 'ch2_away',
        knot: 'ch2_bet',
        options: ['none', 'few', 'many'],
        metric: { kind: 'awayCount' },
        buckets: [1.5, 4.5],
        afterDays: 1,
      },
    };
    const runner = createChapterRunner(f.port, inkOf(CH2_KNOTS), awayBet, flags);
    const prompts = record(runner);
    f.steps(100);
    runner.answerBet('none');
    const twoAway = lite({
      berries: { pim: 0, krit: 0, wisp: 0 },
      patch: { krit: { state: 'away' }, wisp: { state: 'away' } },
    });
    f.steps(450, twoAway);
    expect(prompts.filter((p) => p.kind === 'reveal')).toEqual([
      { kind: 'reveal', answer: 'none', result: 'few' },
    ]);
  });

  test('an answer given inside the bet prompt keeps speed 8 until the reveal', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH2_KNOTS), ch2, flags);
    const prompts: Prompt[] = [];
    runner.onPrompt((p) => {
      prompts.push(p);
      if (p.kind === 'bet') runner.answerBet('echo');
    });
    f.steps(100);
    expect(f.speeds).toEqual([1, 0, 8]);
    f.steps(3150, lite({ berries: { echo: 9, pim: 1 } })); // tick 3250
    expect(f.speeds).toEqual([1, 0, 8, 1]);
    expect(prompts.filter((p) => p.kind === 'reveal')).toEqual([
      { kind: 'reveal', answer: 'echo', result: 'echo' },
    ]);
  });

  test('an answer before the bet opens, or with bet locked, is ignored', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH2_KNOTS), ch2, flags);
    f.steps(50);
    runner.answerBet('pim'); // not open yet
    expect(f.speeds).toEqual([1]);

    const g = fakePort();
    const locked: Chapter = { ...ch2, verbs: ['wake', 'respond'] };
    const lockedRunner = createChapterRunner(g.port, inkOf(CH2_KNOTS), locked, flags);
    g.steps(100); // the bet opens
    lockedRunner.answerBet('pim');
    expect(g.speeds).toEqual([1, 0]);
  });
});

describe('twists', () => {
  test('a twist that never happens triggers exactly 3 retries, then the close-call knot', async () => {
    const f = fakePort();
    const ink = inkOf(CH3_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch3, flags);
    const prompts = record(runner);
    const still = lite({ metrics: { averageWarmth: 0.1, friendPairs: 1 } });
    f.step([], still);
    expect(runner.verb({ verb: 'place', x: 300, y: 200 })).toBe(true); // ch3 opens the window on place
    f.steps(12599, still); // windows end at ticks 3151, 6301, 9451, 12601
    expect(f.sent).toEqual([
      { tick: 1, cmd: { t: 'place', kind: 'bench', x: 300, y: 200 } },
      { tick: 3151, cmd: { t: 'arrangeMeeting', a: 'pim', b: 'echo' } },
      { tick: 6301, cmd: { t: 'arrangeMeeting', a: 'pim', b: 'echo' } },
      { tick: 9451, cmd: { t: 'arrangeMeeting', a: 'pim', b: 'echo' } },
    ]);
    expect(ink.played).not.toContain('ch3_close_call');
    expect(await settled(runner.done)).toBe(false);
    f.step([], still); // tick 12601
    expect(ink.played.at(-1)).toBe('ch3_close_call');
    expect(lines(prompts).at(-1)).toBe('ch3_close_call line.');
    expect(runner.log.filter((e) => e.kind === 'twist')).toEqual([
      { kind: 'twist', tick: 12601, id: 'benchWarmsVillage', fired: false, retries: 3 },
    ]);
    await expect(runner.done).resolves.toEqual({ ...flags, benchPlaced: false, friendThreads: 1 });
    f.steps(5000, still);
    expect(f.sent).toHaveLength(4);
  });

  test('with opensOn, the window stays shut until that verb', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), ch3, flags);
    f.steps(20000, lite({ metrics: { averageWarmth: 0.5, friendPairs: 9 } }));
    expect(f.sent).toEqual([]);
    expect(await settled(runner.done)).toBe(false);
  });

  test('a lantern or a bridge alone does not count as a placed bench', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), ch3, flags);
    const structures: WorldLite['structures'] = [
      { id: 'lantern-1', kind: 'lantern', x: 10, y: 10 },
      { id: 'bridge-2', kind: 'bridge', x: 20, y: 10 },
    ];
    f.steps(10, lite({ metrics: { averageWarmth: 0.1, friendPairs: 1 }, structures }));
    expect(runner.verb({ verb: 'place', x: 300, y: 200 })).toBe(true);
    f.step([], lite({ metrics: { averageWarmth: 0.25, friendPairs: 4 }, structures }));
    await expect(runner.done).resolves.toEqual({ ...flags, benchPlaced: false, friendThreads: 4 });
  });

  test('the bench twist fires on the sim metrics and the flags come from the snapshot', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), ch3, flags);
    f.steps(10, lite({ metrics: { averageWarmth: 0.1, friendPairs: 1 } }));
    expect(runner.verb({ verb: 'place', x: 300, y: 200 })).toBe(true);
    f.steps(10, lite({ metrics: { averageWarmth: 0.15, friendPairs: 4 }, bench: true }));
    expect(await settled(runner.done)).toBe(false); // pairs rose by 3, warmth only by 0.05
    f.step([], lite({ metrics: { averageWarmth: 0.25, friendPairs: 4 }, bench: true }));
    await expect(runner.done).resolves.toEqual({ ...flags, benchPlaced: true, friendThreads: 4 });
    expect(cmds(f)).toEqual([{ t: 'place', kind: 'bench', x: 300, y: 200 }]);
    expect(runner.log.filter((e) => e.kind === 'twist')).toEqual([
      { kind: 'twist', tick: 21, id: 'benchWarmsVillage', fired: true, retries: 0 },
    ]);
  });

  test('Krit exploiting Pim needs the give and the keep in one step; only then the exploit beat plays', async () => {
    const f = fakePort();
    const ink = inkOf(CH2_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch2, { ...flags, pimScar: false });
    f.steps(10);
    f.step([gift('pim', 'krit', 'give')]);
    f.step([gift('krit', 'pim', 'keep')]); // a different meeting: no twist
    expect(ink.played).toEqual(['ch2_intro']); // a gift from Krit alone tells nothing
    expect(await settled(runner.done)).toBe(false);
    f.step([gift('pim', 'krit', 'give'), gift('krit', 'pim', 'keep')]);
    await expect(runner.done).resolves.toEqual({ ...flags, pimScar: true });
    expect(ink.played).toEqual(['ch2_intro', 'ch2_exploit']);
    expect(f.sent).toEqual([]);
  });
});

describe('skip', () => {
  test("skip() returns the chapter's writes filled from content/flags.json and resolves done", async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH3_KNOTS), ch3, flags);
    f.steps(5);
    const skipped = runner.skip();
    expect(skipped).toEqual({ ...flags, benchPlaced: true, friendThreads: 3 });
    await expect(runner.done).resolves.toEqual(skipped);
    expect(runner.verb({ verb: 'place', x: 1, y: 1 })).toBe(false);
    f.steps(20000);
    expect(f.sent).toEqual([]);
  });
});

describe('honesty', () => {
  test('the one send check throws on a command the story may not send on its own', () => {
    for (const cmd of [
      { t: 'shine', x: 1, y: 1 },
      { t: 'paintFog', x: 1, y: 1, r: 1, amount: 1 },
      { t: 'place', kind: 'bench', x: 1, y: 1 },
      { t: 'wake', who: 'pim' },
      { t: 'setSeason', season: 'winter' },
    ] satisfies Command[]) {
      expect(() => {
        assertStoryCommand(cmd);
      }).toThrow(`may not send '${cmd.t}'`);
    }
    expect(() => {
      assertStoryCommand({ t: 'overPoke' });
    }).not.toThrow();
    expect(() => {
      assertStoryCommand({ t: 'arrangeMeeting', a: 'krit', b: 'pim' });
    }).not.toThrow();
  });

  test('every beat action sends only story commands', () => {
    const f = fakePort();
    const chapter: Chapter = {
      ...ch0,
      beats: [
        {
          id: 'all',
          trigger: { at: 0 },
          actions: [
            { arrange: ['krit', 'pim'] },
            { promptSkyBid: 'pim' },
            { rumor: { target: 'echo', about: 'krit', sign: -1 } },
            { dance: 'pim' },
          ],
        },
      ],
      exit: { afterDays: 10 },
    };
    createChapterRunner(f.port, inkOf([]), chapter, flags);
    f.step();
    expect(cmds(f).map((c) => c.t)).toEqual(['arrangeMeeting', 'promptSkyBid', 'whisper', 'dance']);
    expect(cmds(f).every((c) => STORY_COMMANDS.has(c.t))).toBe(true);
  });

  test('over a full chapter the story sends only story commands; the player verbs send their own', async () => {
    const f = fakePort();
    const ink = inkOf(CH2_KNOTS);
    const runner = createChapterRunner(f.port, ink, ch2, flags);
    f.step();
    expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(true);
    f.step([{ t: 'skyBid', who: 'pim' }]);
    expect(runner.verb({ verb: 'respond', reply: 'toward' })).toBe(true);
    f.step([{ t: 'skyBid', who: 'pim' }]); // left for the auto-reply
    expect(runner.verb({ verb: 'place', x: 1, y: 1 })).toBe(false); // locked in chapter 2
    f.steps(100);
    runner.answerBet('krit');
    f.steps(12500); // the bet reveals, every retry runs, then the close call ends the chapter
    await expect(runner.done).resolves.toEqual({ ...flags, pimScar: false });

    // The first two are the player's wake and respond; everything after is the story's.
    expect(
      cmds(f)
        .slice(2)
        .filter((c) => !STORY_COMMANDS.has(c.t)),
    ).toEqual([]);
    expect(cmds(f)).toEqual([
      { t: 'wake', who: 'pim' },
      { t: 'respond', to: 'pim', reply: 'toward' },
      { t: 'respond', to: 'pim', reply: 'away' },
      { t: 'promptSkyBid', who: 'pim' }, // the bid again after the silence
      { t: 'arrangeMeeting', a: 'krit', b: 'pim' },
      { t: 'arrangeMeeting', a: 'krit', b: 'pim' },
      { t: 'arrangeMeeting', a: 'krit', b: 'pim' },
      { t: 'arrangeMeeting', a: 'krit', b: 'pim' },
    ]);
    expect(f.speeds).toEqual([1, 0, 8, 1]);
    expect(ink.played.at(-1)).toBe('ch2_close_call');
    const accepted = runner.log.flatMap((e) => (e.kind === 'accepted' ? e.list : []));
    expect(accepted).toEqual(cmds(f));
  });
});

describe('the year log', () => {
  /** ch0 with no beats and a long day count, so only the events under test happen. */
  const quiet: Chapter = { ...ch0, beats: [], verbs: [], writes: [], exit: { afterDays: 10 } };
  const lit = (a: string, b: string, behaviors: ('toward' | 'against' | 'give' | 'keep')[]): SimEvent => ({
    t: 'lit',
    a,
    b,
    behaviors,
  });

  test('lit, leave, and dance events go in the log; bid events do not', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf([]), quiet, flags);
    f.step();
    const bid: SimEvent = { t: 'bid', from: 'pim', to: 'krit', reply: 'toward', seenAs: 'toward' };
    f.step([bid, lit('pim', 'krit', ['toward']), { t: 'leave', who: 'wisp' }]);
    f.step([{ t: 'dance', who: 'pim' }]);
    expect(runner.log.filter((e) => e.kind === 'event')).toEqual([
      { kind: 'event', tick: 1, e: lit('pim', 'krit', ['toward']) },
      { kind: 'event', tick: 1, e: { t: 'leave', who: 'wisp' } },
      { kind: 'event', tick: 2, e: { t: 'dance', who: 'pim' } },
    ]);
  });

  test('litConflict is 2/3 after three lit meetings, two with a keep', async () => {
    const f = fakePort();
    const chapter: Chapter = { ...quiet, writes: ['litConflict'], exit: { afterDays: 1 } };
    const runner = createChapterRunner(f.port, inkOf([]), chapter, flags);
    f.step();
    f.step([lit('pim', 'krit', ['toward', 'keep'])]);
    f.step([lit('echo', 'krit', ['give'])]);
    f.step([lit('pim', 'echo', ['against', 'give', 'keep'])]);
    f.steps(600);
    await expect(runner.done).resolves.toEqual({ ...flags, litConflict: 2 / 3 });
  });

  test('the Part 1 flags read the last snapshot, the log, and the twist', async () => {
    const f = fakePort();
    const chapter: Chapter = {
      ...quiet,
      writes: ['echoForgiveness', 'winterLeft', 'bellDanced', 'festivalShare', 'mossShared'],
      twist: { id: 'mossShares', withinDays: 5, retryArrange: ['moss', 'krit'] },
      beats: [{ id: 'shared', trigger: { twist: true }, actions: [] }],
      exit: { afterDays: 1 },
    };
    const runner = createChapterRunner(f.port, inkOf([]), chapter, flags);
    f.step();
    f.step([{ t: 'leave', who: 'wisp' }, gift('moss', 'krit', 'give')]);
    f.step([{ t: 'leave', who: 'krit' }]);
    const end = lite({
      berries: { echo: 0, bell: 0, pim: 0, moss: 0, wisp: 0 },
      patch: {
        echo: { dials: { ...dials, forgiveness: 0.8 } },
        bell: { dancing: true },
        pim: { dancing: true },
        wisp: { state: 'away', gone: true },
      },
    });
    f.steps(600, end);
    await expect(runner.done).resolves.toEqual({
      ...flags,
      echoForgiveness: 0.8,
      winterLeft: 2,
      bellDanced: true,
      festivalShare: 0.5, // two of the four not away
      mossShared: true,
    });
  });

  test("echoForgiveness is the received value when the chapter's overrides set Echo's Forgiveness", async () => {
    const f = fakePort();
    const chapter: Chapter = {
      ...quiet,
      overrides: { dials: { echo: { forgiveness: 0 } } },
      writes: ['echoForgiveness'],
      exit: { afterDays: 1 },
    };
    const received = new Map([['echo', { ...dials, forgiveness: 0.6 }]]);
    const runner = createChapterRunner(f.port, inkOf([]), chapter, flags, new Map(), received);
    f.step();
    f.steps(600, lite({ patch: { echo: { dials: { ...dials, forgiveness: 0 } } } }));
    await expect(runner.done).resolves.toEqual({ ...flags, echoForgiveness: 0.6 });
  });
});

describe('activities', () => {
  const interlude: Chapter = {
    ...ch0,
    kind: 'interlude',
    activity: 'rhythm',
    notes: [],
    verbs: [],
    beats: [{ id: 'sung', trigger: { activity: true }, actions: [{ ink: 'i_sung' }, { show: 'heatmap' }] }],
    writes: ['greetingSong'],
    exit: { onBeat: 'sung' },
  };

  test('finishActivity logs once, runs the activity beat, and returns false the second time', async () => {
    const f = fakePort();
    const ink = inkOf(['i_sung']);
    const runner = createChapterRunner(f.port, ink, interlude, flags);
    const shown: string[] = [];
    runner.onShow((what) => shown.push(what));
    expect(runner.finishActivity('3')).toBe(false); // nothing runs before the first snapshot
    f.step();
    expect(runner.finishActivity('3')).toBe(true);
    expect(runner.finishActivity('5')).toBe(false);
    expect(ink.played).toEqual(['i_sung']);
    expect(shown).toEqual(['heatmap']);
    expect(runner.log.filter((e) => e.kind === 'activity')).toEqual([
      { kind: 'activity', tick: 1, activity: 'rhythm', result: '3' },
    ]);
    f.step();
    await expect(runner.done).resolves.toEqual({ ...flags, greetingSong: 3 });
  });

  test('a result that is not a number leaves greetingSong at its default', async () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(['i_sung']), interlude, { ...flags, greetingSong: 4 });
    f.step();
    expect(runner.finishActivity('loud')).toBe(true);
    f.step();
    await expect(runner.done).resolves.toEqual({ ...flags, greetingSong: 0 });
  });

  test('finishActivity is false in a chapter with no activity', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf(CH0_KNOTS), ch0, flags);
    f.step();
    expect(runner.finishActivity('3')).toBe(false);
    expect(runner.log.filter((e) => e.kind === 'activity')).toEqual([]);
  });
});

describe('diaries', () => {
  const quiet: Chapter = {
    ...ch0,
    beats: [],
    diary: { krit: ['[PLACEHOLDER] Last winter I was hungry.'] },
    exit: { afterDays: 10 },
  };

  test("Krit's diary starts with the chapter's authored line, then a line that names Echo for Echo's gift", () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf([]), quiet, flags);
    f.step();
    f.step([gift('echo', 'krit', 'give')]);
    const diary = runner.diary('krit');
    expect(diary).toHaveLength(2);
    expect(diary[0]).toBe('[PLACEHOLDER] Last winter I was hungry.');
    expect(diary[1]).toContain('Echo');
    expect(runner.diary('echo')).toHaveLength(1); // the giver's side
    expect(runner.diary('pim')).toEqual([]);
  });

  test('a diary keeps the last 20 events', () => {
    const f = fakePort();
    const runner = createChapterRunner(f.port, inkOf([]), quiet, flags);
    f.step();
    f.step([{ t: 'dance', who: 'pim' }]);
    for (let i = 0; i < 20; i++) f.step([{ t: 'leave', who: 'pim' }]);
    const diary = runner.diary('pim');
    expect(diary).toHaveLength(20);
    expect(new Set(diary).size).toBe(1); // the dance fell off the front
    expect(runner.diary('krit')).toEqual(['[PLACEHOLDER] Last winter I was hungry.']);
  });

  test('carried diary lines come first and count toward the 20; diaries holds the event lines only', () => {
    const f = fakePort();
    const carried = new Map([['krit', Array.from({ length: 20 }, (_, i) => `old ${String(i)}`)]]);
    const runner = createChapterRunner(f.port, inkOf([]), quiet, flags, carried);
    f.step();
    f.step([{ t: 'dance', who: 'krit' }]);
    const diary = runner.diary('krit');
    expect(diary).toHaveLength(21); // the authored line, then 20 events
    expect(diary[1]).toBe('old 1'); // 'old 0' fell off the front
    expect(runner.diaries.get('krit')).toEqual(diary.slice(1));
    expect(carried.get('krit')).toHaveLength(20); // the runner copies what it was given
  });
});

// The runner over the real worker core: what it sends replays to the same world.
describe('over the worker core', () => {
  const SEED = 7;
  const dial = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
  const base: Scenario = {
    valleyId: 'kith',
    season: 'spring',
    creatures: [
      { id: 'pim', speciesId: 'kith', name: 'Pim', x: 160, y: 130, berries: 2, dials: dial },
      { id: 'krit', speciesId: 'kith', name: 'Krit', x: 416, y: 130, berries: 2, dials: dial },
    ],
    bushes: [],
    structures: [],
  };
  const m0Source = readFileSync(
    fileURLToPath(new URL('../../../content/ink/m0.ink', import.meta.url)),
    'utf8',
  );
  const m0 = new Compiler(`${FLAG_VARS}\n${m0Source}`).Compile().ToJson() ?? '';
  // A one-day chapter on ch0's 60-second day; the talk beat comes once the light has warmed Pim.
  const config: Chapter = {
    ...ch0,
    id: 'm0',
    verbs: [],
    newVerb: null,
    overrides: {},
    beats: [{ id: 'talk', trigger: { at: 6 }, actions: [{ ink: 'm0_test' }] }],
    writes: [],
    exit: { afterDays: 1 },
  };
  const scenario = buildScenario(config, flags, base);

  function corePort(): {
    port: SimPort;
    accepted: { tick: number; list: Command[] }[];
    checkpoints: number[];
    advance(ticks: number): void;
    lite(): WorldLite;
  } {
    const listeners = new Set<(m: FromWorker) => void>();
    const accepted: { tick: number; list: Command[] }[] = [];
    const checkpoints: number[] = [];
    let last: WorldLite | null = null;
    const core = createWorkerCore(
      (m) => {
        if (m.t === 'accepted') accepted.push({ tick: m.tick, list: m.list });
        if (m.t === 'checkpoint') checkpoints.push(m.tick);
        if (m.t === 'snapshot') last = m.lite;
        for (const cb of [...listeners]) cb(m);
      },
      manualClock(),
      { dev: true },
    );
    const send = (m: ToWorker): void => {
      core(m);
    };
    send({ t: 'init', seed: SEED, tuning: tuningJson, scenario });
    const port: SimPort = {
      send: (list) => {
        send({ t: 'commands', list });
      },
      onMessage(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      speed() {},
      requestHash() {
        return new Promise((resolve) => {
          const off = port.onMessage((m) => {
            if (m.t !== 'hash') return;
            off();
            resolve({ tick: m.tick, value: m.value });
          });
          send({ t: 'hash' });
        });
      },
    };
    return {
      port,
      accepted,
      checkpoints,
      advance: (ticks) => {
        send({ t: 'advance', ticks });
      },
      lite: () => {
        if (!last) throw new Error('no snapshot yet');
        return last;
      },
    };
  }

  test('Ink reads a sim value, its tag arranges a meeting, the exit meets dusk, and the log replays', async () => {
    const f = corePort();
    const runner = createChapterRunner(f.port, createInk(m0), config, flags);
    const prompts = record(runner);
    f.port.send([{ t: 'shine', x: 160, y: 130 }]); // the light lens warms Pim's sky
    f.advance(60); // tick 60: 6 s in, the talk beat
    const pim = f.lite().creatures.find((c) => c.id === 'pim');
    expect(pim?.skyWarmth).toBeGreaterThan(0);
    const shown = Math.round((pim?.skyWarmth ?? NaN) * 100) / 100;
    expect(lines(prompts)[0]).toContain(String(shown));
    f.advance(539); // tick 599: one tick short of a day
    expect(await settled(runner.done)).toBe(false);
    expect(f.checkpoints).toEqual([]);
    f.advance(1); // tick 600: the first dusk checkpoint and the afterDays exit
    expect(f.checkpoints).toEqual([600]);
    await expect(runner.done).resolves.toEqual(flags);
    expect(runner.log.filter((e) => e.kind === 'accepted')).toEqual([
      { kind: 'accepted', tick: 0, list: [{ t: 'shine', x: 160, y: 130 }] },
      { kind: 'accepted', tick: 60, list: [{ t: 'arrangeMeeting', a: 'krit', b: 'pim' }] },
    ]);

    const total = 600;
    const tuning = parseTuning(tuningJson);
    const w: World = createWorld(SEED, tuning, scenario);
    for (let tick = 0; tick < total; tick++) {
      step(
        w,
        f.accepted.filter((a) => a.tick === tick).flatMap((a) => a.list),
        tuning,
      );
    }
    const hash = await f.port.requestHash();
    expect(hash.tick).toBe(total);
    expect(hashWorld(w)).toBe(hash.value);
  });

  test('empty Ink lines are skipped', () => {
    const ink = createInk(compile('=== k ===\nOne.\n\n{false: hidden}\nTwo.\n-> END\n'));
    expect(ink.play('k').lines).toEqual(['One.', 'Two.']);
  });
});
