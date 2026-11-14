import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import sandboxJson from '../../../content/sandbox.json';
import m0Json from '../../../content/scenarios/m0.json';
import sceneJson from '../../../content/scenes/kith-meadow.json';
import type { FromWorker, SimPort, WorldLite } from '../../../src/sim-host/protocol.ts';
import type { Command, Season, SimEvent } from '../../../src/sim/types.ts';
import { CHALLENGES, ChallengesSchema, createChallengeCheck } from '../../../src/story/challenges.ts';
import type { ChallengeId } from '../../../src/story/challenges.ts';
import {
  DEFAULT_SWITCHES,
  SandboxSetupSchema,
  createSandboxRunner,
  sandboxScenario,
} from '../../../src/story/sandbox.ts';
import type { SandboxSetup } from '../../../src/story/sandbox.ts';
import { MARKERS } from '../../../tools/content-validate/placeholder-guard.ts';
import { SANDBOX_BASES as bases } from '../../golden/run-sandbox.ts';

const setup = (over: Partial<SandboxSetup> = {}): SandboxSetup => ({
  seed: 1,
  valley: 'kith',
  kith: null,
  challenge: null,
  knobs: {},
  switches: { ...DEFAULT_SWITCHES },
  structures: [],
  bushes: [],
  ...over,
});
const water = [{ x: 780, y: 0, w: 60, h: 900 }];
/** A snapshot with only what the checks and the runner read. */
const lite = (season: Season, kritSoftness = 0): WorldLite =>
  ({
    season,
    water,
    creatures: [{ id: 'krit', shell: { tightness: 0, bristle: 0, color: 0, softness: kritSoftness } }],
  }) as WorldLite;
const leave: SimEvent = { t: 'leave', who: 'villager-1' };

/** Steps a new check of `id` through `steps` and returns the state after each. */
function run(id: ChallengeId, steps: [WorldLite, SimEvent[]][]): string[] {
  const check = createChallengeCheck(id);
  return steps.map(([l, events]) => check.step(l, events));
}

test('winter fails at the first leave event while it is winter, and passes when winter turns to thaw', () => {
  expect(
    run('winter', [
      [lite('winter'), []],
      [lite('winter'), [leave]],
      [lite('thaw'), []],
    ]),
  ).toEqual(['open', 'failed', 'failed']);
  expect(
    run('winter', [
      [lite('winter'), []],
      [lite('thaw'), []],
      [lite('thaw'), [leave]],
    ]),
  ).toEqual(['open', 'passed', 'passed']);
  // The dusk that turns winter to thaw runs its leave rule first, so its leave was in winter.
  expect(
    run('winter', [
      [lite('winter'), []],
      [lite('thaw'), [leave]],
    ]),
  ).toEqual(['open', 'failed']);
});

test('a leave in autumn does not fail winter', () => {
  expect(
    run('winter', [
      [lite('autumn'), [leave]],
      [lite('winter'), []],
      [lite('thaw'), []],
    ]),
  ).toEqual(['open', 'open', 'passed']);
});

test('bell passes at a dance event for bell and fails when thaw turns to spring', () => {
  const pim: SimEvent = { t: 'dance', who: 'pim' };
  const bell: SimEvent = { t: 'dance', who: 'bell' };
  expect(
    run('bell', [
      [lite('thaw'), [pim]],
      [lite('thaw'), [bell]],
      [lite('spring'), []],
    ]),
  ).toEqual(['open', 'passed', 'passed']);
  expect(
    run('bell', [
      [lite('winter'), [pim]],
      [lite('thaw'), []],
      [lite('spring'), []],
      [lite('spring'), [bell]],
    ]),
  ).toEqual(['open', 'open', 'failed', 'failed']);
  // The festival spreads before dusk, so a Bell dance in the step that turns thaw to spring passes.
  expect(
    run('bell', [
      [lite('thaw'), []],
      [lite('spring'), [bell]],
    ]),
  ).toEqual(['open', 'passed']);
});

test('krit passes when the season turns to spring with softness at least softAt', () => {
  const softAt = CHALLENGES.krit.softAt;
  if (softAt === undefined) throw new Error('krit has no softAt');
  expect(
    run('krit', [
      [lite('thaw', 0), []],
      [lite('spring', softAt), []],
    ]),
  ).toEqual(['open', 'passed']);
  expect(
    run('krit', [
      [lite('thaw', 0.9), []],
      [lite('spring', softAt - 0.01), []],
      [lite('spring', 1), []],
    ]),
  ).toEqual(['open', 'failed', 'failed']);
  // With no Krit in the snapshot, spring fails.
  const noKrit = { ...lite('spring', 1), creatures: [] };
  expect(
    run('krit', [
      [lite('thaw', 1), []],
      [noKrit, []],
    ]),
  ).toEqual(['open', 'failed']);
});

function fakePort() {
  const sent: Command[] = [];
  const listeners = new Set<(m: FromWorker) => void>();
  const port: SimPort = {
    send: (list) => sent.push(...list),
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('no hash')),
  };
  const post = (m: FromWorker) => {
    for (const cb of [...listeners]) cb(m);
  };
  return { port, sent, post };
}

test('the runner refuses a third bridge in the bell challenge and a second Start the dance', () => {
  const { port, sent, post } = fakePort();
  const runner = createSandboxRunner(port, setup({ challenge: 'bell' }));
  expect(runner.startDance()).toBe(false); // before the first snapshot
  post({ t: 'snapshot', tick: 1, lite: lite('winter') });
  expect(runner.challenge()).toBe('open');
  runner.setPlaceKind('bridge');
  expect(runner.verb({ verb: 'place', x: 400, y: 300 })).toBe(false); // dry land does not count
  expect(runner.verb({ verb: 'place', x: 810, y: 300 })).toBe(true);
  expect(runner.verb({ verb: 'place', x: 810, y: 600 })).toBe(true);
  expect(runner.verb({ verb: 'place', x: 810, y: 800 })).toBe(false);
  runner.setPlaceKind('bench');
  expect(runner.verb({ verb: 'place', x: 400, y: 300 })).toBe(true);
  expect(runner.startDance()).toBe(true);
  expect(runner.startDance()).toBe(false);
  expect(sent).toEqual([
    { t: 'place', kind: 'bridge', x: 810, y: 300 },
    { t: 'place', kind: 'bridge', x: 810, y: 600 },
    { t: 'place', kind: 'bench', x: 400, y: 300 },
    { t: 'dance', who: 'pim' },
  ]);
  // The step's events come before its snapshot; the runner tells once when the challenge ends.
  const states: string[] = [];
  runner.onChallenge((s) => states.push(s));
  post({ t: 'events', tick: 1, list: [{ t: 'dance', who: 'bell' }] });
  post({ t: 'snapshot', tick: 2, lite: lite('winter') });
  post({ t: 'snapshot', tick: 3, lite: lite('spring') });
  expect(runner.challenge()).toBe('passed');
  expect(states).toEqual(['passed']);

  // A setup's bridges count toward the limit; Start the dance belongs to the Bell challenge only.
  const two = fakePort();
  const bridge = (id: string, y: number) => ({ id, kind: 'bridge' as const, x: 810, y });
  const kept = createSandboxRunner(
    two.port,
    setup({ challenge: 'bell', structures: [bridge('bridge-1', 300), bridge('bridge-2', 600)] }),
  );
  two.post({ t: 'snapshot', tick: 1, lite: lite('winter') });
  kept.setPlaceKind('bridge');
  expect(kept.verb({ verb: 'place', x: 810, y: 800 })).toBe(false);
  const winter = fakePort();
  const other = createSandboxRunner(winter.port, setup({ challenge: 'winter' }));
  winter.post({ t: 'snapshot', tick: 1, lite: lite('winter') });
  expect(other.startDance()).toBe(false);
  expect(createSandboxRunner(winter.port, setup()).challenge()).toBeNull();
});

test('the challenges file has the three spec texts, untagged', () => {
  const texts = [
    'Get through winter with nobody leaving.',
    'Make Bell dance with only two bridges.',
    "Soften Krit's spikes by spring.",
  ];
  const parsed = ChallengesSchema.parse(sandboxJson);
  expect(parsed.challenges.map((c) => c.text)).toEqual(texts);
  const spec = readFileSync(
    new URL('../../../docs/superpowers/specs/2026-11-11-fair-weather-design.md', import.meta.url),
    'utf8',
  );
  const line = spec.split('\n').find((l) => l.startsWith('- Challenges:')) ?? '';
  for (const t of texts) expect(line).toContain(`"${t}"`);
  for (const c of parsed.challenges) {
    for (const m of MARKERS) expect(c.text).not.toContain(m);
    expect(c.pass.startsWith('[PLACEHOLDER] ')).toBe(true);
    expect(c.fail.startsWith('[PLACEHOLDER] ')).toBe(true);
  }
});

test("sandboxScenario applies the challenge's start last, and the schema keeps a challenge on a new Kith", () => {
  const krit = sandboxScenario(setup({ challenge: 'krit' }), bases, sceneJson.benchSpots);
  expect(krit.season).toBe(CHALLENGES.krit.start.season); // not Kith's spring
  expect(krit.creatures.find((c) => c.id === 'krit')?.shell).toEqual(CHALLENGES.krit.start.shell?.krit);
  const bell = sandboxScenario(setup({ challenge: 'bell' }), bases, sceneJson.benchSpots);
  expect(bell.water).toEqual(water);
  expect(bell.creatures.find((c) => c.id === 'bell')?.danceThreshold).toBe(3);
  const winter = sandboxScenario(
    setup({ challenge: 'winter', bushes: [{ id: 'bush-9', x: 700, y: 300 }] }),
    bases,
    sceneJson.benchSpots,
  );
  const most = CHALLENGES.winter.start.berries ?? Infinity;
  for (const x of [...winter.bushes, ...winter.creatures]) expect(x.berries).toBeLessThanOrEqual(most);
  expect(winter.bushes).toHaveLength(m0Json.bushes.length + 1);

  const ok = (s: SandboxSetup) => SandboxSetupSchema.safeParse(s).success;
  const pim = m0Json.creatures[0];
  if (!pim) throw new Error('m0 has no creatures');
  const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
  const kith = {
    creatures: [{ id: pim.id, dials: pim.dials, shell, skyWarmth: 0, away: false, gone: false, diary: [] }],
    ties: [],
  };
  expect(ok(setup({ challenge: 'bell' }))).toBe(true);
  expect(ok(setup({ kith }))).toBe(true);
  expect(ok(setup({ challenge: 'bell', kith }))).toBe(false);
  expect(ok(setup({ challenge: 'winter', valley: 'fen' }))).toBe(false);
  const bridges = [300, 500, 600].map((y, i) => ({
    id: `b-${String(i)}`,
    kind: 'bridge' as const,
    x: 810,
    y,
  }));
  expect(ok(setup({ challenge: 'bell', structures: bridges.slice(0, 2) }))).toBe(true);
  expect(ok(setup({ challenge: 'bell', structures: bridges }))).toBe(false);
});
