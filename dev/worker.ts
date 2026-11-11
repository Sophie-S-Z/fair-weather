// Dev page: with ?golden, runs the M0 golden scenario in the real worker and shows the hash.
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import commandsJson from '../tests/golden/m0-commands.json';
import golden from '../tests/golden/m0-hash.json';
import { createSimHost } from '../src/sim-host/host.ts';
import type { Command, Scenario } from '../src/sim/types.ts';

const out = document.getElementById('hash');

async function runGolden(): Promise<string> {
  const host = createSimHost(
    () => new Worker(new URL('../src/sim-host/worker.ts', import.meta.url), { type: 'module' }),
  );
  host.onMessage((m) => {
    if (m.t === 'error') console.error(`worker error at tick ${String(m.lastGoodTick)}: ${m.message}`);
  });
  host.post({ t: 'init', seed: golden.seed, tuning: tuningJson, scenario: scenarioJson as Scenario });
  let at = 0;
  for (const { tick, cmd } of commandsJson as { tick: number; cmd: Command }[]) {
    if (tick > at) host.post({ t: 'advance', ticks: tick - at });
    at = tick;
    host.send([cmd]);
  }
  host.post({ t: 'advance', ticks: golden.ticks - at });
  const { value } = await host.requestHash();
  return value;
}

if (out && new URLSearchParams(location.search).has('golden')) {
  runGolden().then(
    (value) => {
      out.textContent = value;
    },
    (e: unknown) => {
      out.textContent = `failed: ${String(e)}`;
    },
  );
}
