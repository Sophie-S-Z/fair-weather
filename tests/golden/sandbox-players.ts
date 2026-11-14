// Scripted sandbox players for the challenge calibration (ADR 0014 item 6). Make a new one per run:
// a player may keep state.
import m0Json from '../../content/scenarios/m0.json';
import type { SandboxPlayer } from './run-sandbox.ts';

/** Winter: darkens the gate at tick 1, so no hungry newcomer comes, and rains on every bush twice a day. */
export const feedsTheValley = (): SandboxPlayer => ({
  onTick(tick, runner) {
    if (tick === 1) runner.verb({ verb: 'welcome', on: false });
    if (tick % 200 !== 1) return;
    for (const b of m0Json.bushes) runner.verb({ verb: 'rain', x: b.x, y: b.y });
  },
});

/** Bell: starts the dance, then places a bridge at (810, 300) and one at (810, 600). */
export const bridgesTheBrook = (): SandboxPlayer => {
  const bridges = [
    { x: 810, y: 300 },
    { x: 810, y: 600 },
  ];
  let danced = false;
  return {
    onTick(_tick, runner) {
      if (!danced) danced = runner.startDance();
      runner.setPlaceKind('bridge');
      const at = bridges[0];
      if (at && runner.verb({ verb: 'place', ...at })) bridges.shift();
    },
  };
};

/** Krit: at tick 1 and each dawn, threads Krit to every other creature in the valley. */
export const warmsKrit = (): SandboxPlayer => ({
  onTick(tick, runner, lite) {
    if (tick % 400 !== 1) return;
    for (const c of lite.creatures)
      if (c.id !== 'krit' && c.state !== 'away')
        runner.verb({ verb: 'thread', a: 'krit', b: c.id, on: true });
  },
});

/** The idle player: in the Bell challenge it presses "Start the dance" at tick 1; otherwise nothing. */
export const idle = (): SandboxPlayer => ({
  onTick(tick, runner) {
    if (tick === 1) runner.startDance();
  },
});
