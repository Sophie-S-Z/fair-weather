// Chapter 0 still ends after a long idle start (M1.12 fix round 1): the cast sleeps, and a sleeper
// never gets hungry or leaves, so Pim is there for the sky bid that ends the chapter.
import { expect, test } from 'vitest';
import ch0Json from '../../content/chapters/ch0.json';
import flagsJson from '../../content/flags.json';
import inkStory from '../../content/ink/main.ink';
import scenarioJson from '../../content/scenarios/m0.json';
import tuningJson from '../../content/tuning.json';
import type { FromWorker, SimPort, WorldLite } from '../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../src/sim-host/worker-core.ts';
import type { Scenario } from '../../src/sim/types.ts';
import { createChapterRunner } from '../../src/story/chapter-runner.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { createInk } from '../../src/story/ink.ts';
import { buildScenario } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';

const ch0 = ChapterSchema.parse(ch0Json);
const IDLE_DAYS = 20;

test(`ch0: after ${String(IDLE_DAYS)} idle days, waking a villager still ends the chapter`, async () => {
  const flags = parseFlags(flagsJson);
  const listeners = new Set<(m: FromWorker) => void>();
  // Set from callbacks, so an object: a plain `let` would look constant to the code below.
  const seen = { lite: null as WorldLite | null, over: false };
  const core = createWorkerCore(
    (m) => {
      if (m.t === 'snapshot') seen.lite = m.lite;
      for (const cb of [...listeners]) cb(m);
    },
    { now: () => 0, every: () => () => undefined },
  );
  core({
    t: 'init',
    seed: 1,
    tuning: tuningJson,
    scenario: buildScenario(ch0, flags, scenarioJson as Scenario),
  });
  const port: SimPort = {
    send: (list) => {
      core({ t: 'commands', list });
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('not used')),
  };
  const runner = createChapterRunner(port, createInk(inkStory), ch0, flags);
  void runner.done.then(() => (seen.over = true));

  const ticksPerDay = ch0.dayLengthSeconds * tuningJson.sim.stepsPerSecond;
  core({ t: 'advance', ticks: IDLE_DAYS * ticksPerDay });
  const pim = seen.lite?.creatures.find((c) => c.id === 'pim');
  expect(pim?.state).toBe('sleep');

  // The wake goes to an awake villager, so Pim is still asleep when the beat prompts its sky bid.
  expect(runner.verb({ verb: 'wake', who: 'villager-1' })).toBe(true);
  for (let i = 0; i < 100 && !seen.over; i++) {
    core({ t: 'advance', ticks: 1 });
    await Promise.resolve();
  }
  expect(seen.over).toBe(true);
  expect(runner.log.some((e) => e.kind === 'verb')).toBe(true);
});
