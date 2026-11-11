import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import { hashWorld } from '../../../src/sim/hash.ts';
import { step } from '../../../src/sim/step.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Command, Scenario, World } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';
import type { FromWorker, SimPort, ToWorker, WorldLite } from '../../../src/sim-host/protocol.ts';
import { createDirector } from '../../../src/story/director.ts';
import { createInk } from '../../../src/story/ink.ts';
import { manualClock } from '../sim-host/harness.ts';

const SEED = 7;
const dial = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
// Pim and Krit sit apart; the light lens on Pim warms Pim's sky (the value Ink prints).
const scenario: Scenario = {
  valleyId: 'kith',
  season: 'spring',
  creatures: [
    { id: 'pim', speciesId: 'kith', name: 'Pim', x: 160, y: 130, berries: 2, dials: dial },
    { id: 'krit', speciesId: 'kith', name: 'Krit', x: 416, y: 130, berries: 2, dials: dial },
  ],
  bushes: [],
  structures: [],
};

function compile(source: string): string {
  return new Compiler(source).Compile().ToJson() ?? '';
}
const m0 = compile(
  readFileSync(fileURLToPath(new URL('../../../content/ink/m0.ink', import.meta.url)), 'utf8'),
);

/** A SimPort over the real worker core and a manual clock; `advance` moves ticks. */
function fakePort(): {
  port: SimPort;
  sent: Command[][];
  accepted: { tick: number; list: Command[] }[];
  advance(ticks: number): void;
  lite(): WorldLite;
} {
  const listeners = new Set<(m: FromWorker) => void>();
  const sent: Command[][] = [];
  const accepted: { tick: number; list: Command[] }[] = [];
  let last: WorldLite | null = null;
  const core = createWorkerCore(
    (m) => {
      if (m.t === 'accepted') accepted.push({ tick: m.tick, list: m.list });
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
    send(list) {
      sent.push(list);
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
    sent,
    accepted,
    advance: (ticks) => {
      send({ t: 'advance', ticks });
    },
    lite: () => {
      if (!last) throw new Error('no snapshot yet');
      return last;
    },
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const beat = {
  knot: 'm0_test',
  vars: {
    pim_sky_warmth: (l: WorldLite) => round2(l.creatures.find((c) => c.id === 'pim')?.skyWarmth ?? NaN),
  },
};

function warmPim(f: ReturnType<typeof fakePort>): void {
  f.port.send([{ t: 'shine', x: 160, y: 130 }]);
  f.advance(60);
}

test('a beat writes a sim value into Ink, plays the knot, and sends arrangeMeeting', async () => {
  const f = fakePort();
  const director = createDirector(f.port, createInk(m0)); // learns the world from snapshots
  warmPim(f);
  const pim = f.lite().creatures.find((c) => c.id === 'pim');
  expect(pim?.skyWarmth).toBeGreaterThan(0);
  f.sent.length = 0;
  const result = await director.runBeat(beat);
  const shown = round2(f.lite().creatures.find((c) => c.id === 'pim')?.skyWarmth ?? NaN);
  expect(result.lines[0]).toContain(String(shown));
  expect(f.sent).toEqual([[{ t: 'arrangeMeeting', a: 'krit', b: 'pim' }]]);
});

test('the director never sends a command that the beat tags did not name', async () => {
  const f = fakePort();
  const quiet = createInk(compile('VAR x = 0\n=== k ===\nJust talk {x}. #placeholder\n-> END\n'));
  const director = createDirector(f.port, quiet);
  f.advance(1);
  await director.runBeat({ knot: 'k', vars: { x: () => 1 } });
  expect(f.sent).toEqual([]);
});

test('an unparseable beat tag throws an Error naming the tag', async () => {
  const f = fakePort();
  const bad = createInk(compile('=== k ===\nHi. #beat:drop_table()\n-> END\n'));
  const director = createDirector(f.port, bad);
  f.advance(1);
  await expect(director.runBeat({ knot: 'k', vars: {} })).rejects.toThrow('beat:drop_table()');
  expect(f.sent).toEqual([]);
});

// Replay determinism only. The honesty rule (spec 10.2) is guarded by
// 'the director never sends a command that the beat tags did not name' above.
test('replay determinism: the run with the director equals a direct run with the same accepted log', async () => {
  const f = fakePort();
  const director = createDirector(f.port, createInk(m0));
  warmPim(f);
  await director.runBeat(beat);
  f.advance(120);
  const total = 180;

  const tuning = parseTuning(tuningJson);
  const w: World = createWorld(SEED, tuning, scenario);
  for (let tick = 0; tick < total; tick++) {
    const list = f.accepted.filter((a) => a.tick === tick).flatMap((a) => a.list);
    step(w, list, tuning);
  }
  const hash = await f.port.requestHash();
  expect(w.tick).toBe(total);
  expect(f.accepted.some((a) => a.list.some((c) => c.t === 'arrangeMeeting'))).toBe(true);
  expect(hashWorld(w)).toBe(hash.value);
});

test('a bad beat tag after a good one throws and sends nothing', async () => {
  const f = fakePort();
  const ink = createInk(
    compile('=== k ===\nA. #beat:arrange_meeting(krit,pim)\nB. #beat:drop_table()\n-> END\n'),
  );
  const director = createDirector(f.port, ink);
  f.advance(1);
  await expect(director.runBeat({ knot: 'k', vars: {} })).rejects.toThrow('beat:drop_table()');
  expect(f.sent).toEqual([]);
});

test('empty Ink lines are skipped', () => {
  const ink = createInk(compile('=== k ===\nOne.\n\n{false: hidden}\nTwo.\n-> END\n'));
  expect(ink.play('k').lines).toEqual(['One.', 'Two.']);
});
