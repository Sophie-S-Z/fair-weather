// The sandbox challenges (spec 13.1, ADR 0014 item 6): each card's text, the start a challenge adds
// to its setup's scenario, and the check that passes or fails the run.
import { z } from 'zod';
// With the import attribute, so tools/content-validate can load this file in Node.
import sandboxJson from '../../content/sandbox.json' with { type: 'json' };
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Scenario, Season, SimEvent } from '../sim/types.ts';
import { SHELL_SHAPE } from './carry.ts';
import { OverridesSchema, season } from './schema.ts';

export const CHALLENGE_IDS = ['winter', 'bell', 'krit'] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];
export type ChallengeState = 'open' | 'passed' | 'failed';

const id = z.string().regex(/^[a-z0-9-]{1,40}$/);
const line = z.string().min(1);

/**
 * content/sandbox.json: the three challenges in CHALLENGE_IDS order. `text` is the spec's (the
 * user's, so untagged). `start` is what the challenge sets on its scenario (`berries` is the most
 * berries a bush or a creature starts with), and `bridgeLimit` is the most bridges the runner
 * sends. `softAt` is the softness of Krit that passes; only krit has it.
 */
export const ChallengesSchema = z
  .strictObject({
    challenges: z.array(
      z.strictObject({
        id: z.enum(CHALLENGE_IDS),
        text: line,
        start: z.strictObject({
          season,
          water: OverridesSchema.shape.water,
          berries: z.number().nonnegative().optional(),
          shell: z.record(id, z.strictObject(SHELL_SHAPE)).optional(),
          danceThreshold: OverridesSchema.shape.danceThreshold,
          bridgeLimit: z.number().int().nonnegative().optional(),
        }),
        softAt: z.number().min(0).max(1).optional(),
        pass: line,
        fail: line,
      }),
    ),
  })
  .superRefine((file, ctx) => {
    const ids = file.challenges.map((c) => c.id);
    if (ids.join() !== CHALLENGE_IDS.join())
      ctx.addIssue({ code: 'custom', message: `Lists ${ids.join(', ')}, not ${CHALLENGE_IDS.join(', ')}` });
    for (const c of file.challenges)
      if ((c.softAt !== undefined) !== (c.id === 'krit'))
        ctx.addIssue({ code: 'custom', message: `${c.id}: only krit has softAt` });
  });
export type Challenge = z.infer<typeof ChallengesSchema>['challenges'][number];

/** The three challenges by id. */
export const CHALLENGES = Object.fromEntries(
  ChallengesSchema.parse(sandboxJson).challenges.map((c) => [c.id, c]),
) as Record<ChallengeId, Challenge>;

/**
 * Sets `start` on `s` (ADR 0014 item 6): its season, its water, at most `berries` berries on each
 * bush and creature, each named creature's shell as its shell and resting shell, and each named
 * dance threshold. Throws on a creature `s` lacks.
 */
export function applyStart(s: Scenario, start: Challenge['start']): void {
  const creature = (cid: string): Scenario['creatures'][number] => {
    const c = s.creatures.find((x) => x.id === cid);
    if (!c) throw new Error(`The challenge start names unknown creature "${cid}"`);
    return c;
  };
  s.season = start.season;
  if (start.water) s.water = start.water.map((r) => ({ ...r }));
  const most = start.berries;
  if (most !== undefined)
    for (const x of [...s.bushes, ...s.creatures]) x.berries = Math.min(x.berries, most);
  // The sim starts a creature's resting shell from its scenario shell (sim/world.ts).
  for (const [cid, shell] of Object.entries(start.shell ?? {})) creature(cid).shell = { ...shell };
  for (const [cid, n] of Object.entries(start.danceThreshold ?? {})) creature(cid).danceThreshold = n;
}

export interface ChallengeCheck {
  /**
   * Reads one step: `lite` is its snapshot and `events` its events. Returns the state after it;
   * once passed or failed, it stays.
   */
  step(lite: WorldLite, events: readonly SimEvent[]): ChallengeState;
}

/** True when the season turned from `from` (or any season, with null) to `to` in this step. */
const turned = (before: Season, after: Season, from: Season | null, to: Season): boolean =>
  before !== after && after === to && (from === null || before === from);

/**
 * The check of ADR 0014 item 6. A step's events happen in the season before its snapshot's, since
 * the season turns last, at the end of the dusk (sim/daily/index.ts).
 * - winter: fails at a `leave` event while it is winter; passes when winter turns to thaw.
 * - bell: passes at a `dance` event for Bell; fails when thaw turns to spring first.
 * - krit: when the season turns to spring, passes with Krit's softness at least `softAt` and
 *   fails below it (or without Krit).
 */
export function createChallengeCheck(cid: ChallengeId): ChallengeCheck {
  const { softAt } = CHALLENGES.krit;
  let state: ChallengeState = 'open';
  let season: Season | null = null;
  const judge = (before: Season, lite: WorldLite, events: readonly SimEvent[]): ChallengeState => {
    switch (cid) {
      case 'winter':
        if (before === 'winter' && events.some((e) => e.t === 'leave')) return 'failed';
        return turned(before, lite.season, 'winter', 'thaw') ? 'passed' : 'open';
      case 'bell':
        if (events.some((e) => e.t === 'dance' && e.who === 'bell')) return 'passed';
        return turned(before, lite.season, 'thaw', 'spring') ? 'failed' : 'open';
      case 'krit': {
        if (!turned(before, lite.season, null, 'spring')) return 'open';
        const krit = lite.creatures.find((c) => c.id === 'krit');
        return krit && softAt !== undefined && krit.shell.softness >= softAt ? 'passed' : 'failed';
      }
    }
  };
  return {
    step(lite, events) {
      // Before the first snapshot the season is the first snapshot's: no step turned it yet.
      const before = season ?? lite.season;
      season = lite.season;
      if (state === 'open') state = judge(before, lite, events);
      return state;
    },
  };
}
