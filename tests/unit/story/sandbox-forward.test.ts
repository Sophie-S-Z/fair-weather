// An opened challenge link (ADR 0014 items 6 and 7): the worker runs the link's ticks in one
// fast-forward, and the runner reads the forward's steps, so its challenge state is the one the
// same steps give live.
import { expect, test } from 'vitest';
import kithScene from '../../../content/scenes/kith-meadow.json';
import m0Json from '../../../content/scenarios/m0.json';
import fenJson from '../../../content/scenarios/fen.json';
import hollowJson from '../../../content/scenarios/hollow.json';
import halcyonJson from '../../../content/scenarios/halcyon.json';
import tuningJson from '../../../content/tuning.json';
import type { FromWorker, SimPort, ToWorker } from '../../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';
import type { Scenario } from '../../../src/sim/types.ts';
import type { ChallengeId } from '../../../src/story/challenges.ts';
import {
  DEFAULT_SWITCHES,
  createSandboxRunner,
  sandboxScenario,
  sandboxTuning,
} from '../../../src/story/sandbox.ts';
import type { SandboxRunner, SandboxSetup } from '../../../src/story/sandbox.ts';

const BASES = {
  kith: m0Json as Scenario,
  fen: fenJson as Scenario,
  hollow: hollowJson as Scenario,
  halcyon: halcyonJson as Scenario,
};
const NO_CLOCK = { now: () => 0, every: () => () => undefined };

/** A challenge on a new Kith of seed 1, with the shortest seasons (two days), so it ends soon. */
const setup = (challenge: ChallengeId): SandboxSetup => ({
  seed: 1,
  valley: 'kith',
  kith: null,
  challenge,
  knobs: { seasonLength: 0 },
  switches: { ...DEFAULT_SWITCHES },
  structures: [],
  bushes: [],
});

/** A worker core in this process behind a port, and the sandbox runner of `s` on it. */
function runOn(s: SandboxSetup): { send: (m: ToWorker) => void; got: FromWorker[]; runner: SandboxRunner } {
  const listeners = new Set<(m: FromWorker) => void>();
  const got: FromWorker[] = [];
  const send = createWorkerCore((m) => {
    got.push(m);
    for (const cb of [...listeners]) cb(m);
  }, NO_CLOCK);
  const port: SimPort = {
    send: (list) => {
      send({ t: 'commands', list });
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('not used here')),
  };
  const runner = createSandboxRunner(port, s);
  const scenario = sandboxScenario(s, BASES, kithScene.benchSpots);
  send({ t: 'init', seed: s.seed, tuning: sandboxTuning(s, tuningJson), scenario });
  return { send, got, runner };
}

for (const challenge of ['winter', 'bell', 'krit'] as const) {
  test(`a ${challenge} run forwarded with its steps ends as the same run stepped live`, () => {
    // Live: one step at a time until the challenge ends.
    const live = runOn(setup(challenge));
    let ticks = 0;
    while (live.runner.challenge() === 'open' && ticks < 4000) {
      live.send({ t: 'advance', ticks: 1 });
      ticks += 1;
    }
    const want = live.runner.challenge();
    expect(want).not.toBe('open');

    // Opened: past the end in one reported forward, then one tick live, as a link opens.
    const opened = runOn(setup(challenge));
    opened.send({ t: 'fastForward', ticks: ticks + 200, id: 1, report: true });
    const forwarded = opened.got.find((m) => m.t === 'forwarded');
    opened.runner.forwarded(forwarded?.t === 'forwarded' ? (forwarded.steps ?? []) : []);
    opened.send({ t: 'advance', ticks: 1 });
    expect(opened.runner.challenge()).toBe(want);
  });
}

test('a run without a challenge reads forwarded steps and stays without one', () => {
  const s: SandboxSetup = { ...setup('winter'), challenge: null };
  const opened = runOn(s);
  opened.send({ t: 'fastForward', ticks: 900, id: 1, report: true });
  const forwarded = opened.got.find((m) => m.t === 'forwarded');
  opened.runner.forwarded(forwarded?.t === 'forwarded' ? (forwarded.steps ?? []) : []);
  opened.send({ t: 'advance', ticks: 1 });
  expect(opened.runner.challenge()).toBeNull();
});
