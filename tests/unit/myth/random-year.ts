// Synthetic random play for T6 (ADR 0012 item 11): year logs in the chapter runner's log format.
import { readdirSync, readFileSync } from 'node:fs';
import scenarioJson from '../../../content/scenarios/m0.json';
import tuningJson from '../../../content/tuning.json';
import type { Behavior, BidReply } from '../../../src/sim/types.ts';
import type { Rng } from '../../../src/sim/rng.ts';
import type { ActionLog, YearLog } from '../../../src/story/action-log.ts';
import type { Flags } from '../../../src/story/flags.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { WORLD_VERBS } from '../../../src/story/verbs.ts';
import type { VerbInput, WorldVerb } from '../../../src/story/verbs.ts';

const chaptersDir = new URL('../../../content/chapters/', import.meta.url);
const CHAPTERS = readdirSync(chaptersDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ChapterSchema.parse(JSON.parse(readFileSync(new URL(f, chaptersDir), 'utf8'))))
  .map((c) => ({ id: c.id, verbs: WORLD_VERBS.filter((v) => c.verbs.includes(v)) }));
const IDS = scenarioJson.creatures.map((c) => c.id);
const CAST = ['pim', 'krit', 'echo', 'moss', 'wisp', 'bell'] as const;
const REPLIES: readonly BidReply[] = ['toward', 'away', 'against'];
const { width, height } = tuningJson.scene;

/** An integer from `lo` to `hi`, both included. */
const between = (rng: Rng, lo: number, hi: number): number => lo + rng.int(hi - lo + 1);
const coin = (rng: Rng): boolean => rng.next() < 0.5;

function randomVerb(rng: Rng, verb: WorldVerb): VerbInput {
  const x = rng.next() * width;
  const y = rng.next() * height;
  switch (verb) {
    case 'wake':
      return { verb, who: rng.pick(IDS) };
    case 'respond':
      return { verb, reply: rng.pick(REPLIES) };
    case 'place':
    case 'shine':
      return { verb, x, y };
    case 'whisper':
      return { verb, target: rng.pick(IDS), about: rng.pick(IDS), sign: coin(rng) ? 1 : -1 };
    case 'thread':
      return { verb, a: rng.pick(IDS), b: rng.pick(IDS), on: coin(rng) };
    case 'fog':
      return { verb, x, y, clear: coin(rng) };
    case 'blow':
      return { verb, x, y, dx: rng.next() * 2 - 1, dy: rng.next() * 2 - 1 };
    case 'walk':
    case 'manner':
    case 'join':
    case 'pose':
    case 'keepsake':
      throw new Error(`No Part 1 chapter lists the Part 2 verb ${verb}`);
  }
}

function randomFlags(rng: Rng): Flags {
  return {
    pimSkyBond: rng.next(),
    pimSkyOpinion: rng.pick([-1, 0, 1] as const),
    pimScar: coin(rng),
    benchPlaced: coin(rng),
    friendThreads: between(rng, 0, 20),
    litConflict: rng.next(),
    rumorStuck: coin(rng),
    echoForgiveness: rng.next(),
    wispPushed: coin(rng),
    mossShared: coin(rng),
    winterLeft: between(rng, 0, 6),
    bellDanced: coin(rng),
    festivalShare: rng.next(),
    greetingSong: between(rng, 0, 5),
    // The Part 2 flags keep their defaults (no draws), so the Part 1 years stay the same.
    toveFlew: true,
    heroFamous: false,
    wispHome: false,
    kithHeld: true,
  };
}

/** One random year: per chapter, random world verbs, lit meetings, and arrivals, plus random flags and sky warmths. */
export function randomYear(rng: Rng): { year: YearLog; flags: Flags; skyWarmth: Record<string, number> } {
  // A year leans kind or quarrelsome: each behavior is against or keep with chance `conflict`.
  const conflict = rng.next();
  const behavior = (): Behavior =>
    rng.next() < conflict ? rng.pick(['against', 'keep'] as const) : rng.pick(['toward', 'give'] as const);
  const year: YearLog = CHAPTERS.map((chapter) => {
    const log: ActionLog = [];
    let tick = 0;
    if (chapter.verbs.length > 0)
      for (let n = between(rng, 0, 12); n > 0; n--)
        log.push({ kind: 'verb', tick: (tick += 1), input: randomVerb(rng, rng.pick(chapter.verbs)) });
    for (let n = between(rng, 0, 40); n > 0; n--) {
      const a = rng.pick(IDS);
      const b = rng.pick(IDS.filter((id) => id !== a));
      const behaviors = [behavior(), behavior()];
      log.push({ kind: 'event', tick: (tick += 1), e: { t: 'lit', a, b, behaviors } });
    }
    for (let n = between(rng, 0, 3); n > 0; n--)
      log.push({ kind: 'event', tick: (tick += 1), e: { t: 'arrive', who: rng.pick(IDS) } });
    return { chapterId: chapter.id, log };
  });
  const skyWarmth = Object.fromEntries(IDS.map((id) => [id, rng.next() * 2 - 1]));
  // About half the years, a named cast member is warmest, so its voiced templates get told.
  if (coin(rng)) skyWarmth[rng.pick(CAST)] = 1;
  return { year, flags: randomFlags(rng), skyWarmth };
}
