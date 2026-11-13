// Scripted players for the T3 runs and the year run, by chapter id. Make a new one per run: a
// player may keep state.
import sceneJson from '../../content/scenes/kith-meadow.json';
import fenJson from '../../content/valleys/fen.json';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { creature } from '../../src/story/bets.ts';
import { heroResult } from '../../src/story/journey.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { tuning } from '../../src/story/tuning.ts';
import type { ScriptedPlayer } from './run-chapter.ts';

const spot = sceneJson.benchSpots.find((s) => s.id === 'under-crooked-tree');
if (!spot) throw new Error('kith-meadow has no bench spot under the crooked tree');
const bench = spot;

/** Answers a bet with its first option; leaves sky bids to the runner's automatic 'away'. */
export const firstOption: NonNullable<ScriptedPlayer['onPrompt']> = (p, runner) => {
  if (p.kind === 'bet' && p.options[0] !== undefined) runner.answerBet(p.options[0]);
};

/** Sends the first postcard the card lists, as soon as it opens. */
const firstPostcard: NonNullable<ScriptedPlayer['onPrompt']> = (p, runner) => {
  if (p.kind === 'postcard' && p.options[0] !== undefined) runner.sendPostcard(p.options[0]);
};

const fenDay = chapterTicksPerDay(fenJson);

/**
 * The Fen's player: walks to Tove every 20 ticks and sends the first postcard. With `joins`, it
 * joins the flock from fen.duskAt of each day and lands at dawn, as the starlings do.
 */
export const walksToTove = (joins: boolean) => (): ScriptedPlayer => {
  let next = 0;
  let joined = false;
  return {
    onPrompt: firstPostcard,
    onTick(tick, runner) {
      if (tick >= next && runner.verb({ verb: 'walk', to: 'tove' })) next = tick + 20;
      const dusk = tick % fenDay >= tuning.fen.duskAt * fenDay;
      if (joins && dusk !== joined && runner.verb({ verb: 'join', on: dusk })) joined = dusk;
    },
  };
};

/** Finishes the interlude's activity with `result` as soon as the runner takes it. */
const finishes = (result: string) => (): ScriptedPlayer => {
  let done = false;
  return {
    onTick(_tick, runner) {
      if (!done) done = runner.finishActivity(result);
    },
  };
};

/** The `n` villagers nearest `id` in `lite`, nearest first. */
function nearestVillagers(lite: WorldLite, id: string, n: number): string[] {
  const at = creature(lite, id);
  if (!at) return [];
  const d = (c: { x: number; y: number }) => (c.x - at.x) ** 2 + (c.y - at.y) ** 2;
  return lite.creatures
    .filter((c) => c.id.startsWith('villager-') && c.state !== 'away')
    .sort((a, b) => d(a) - d(b))
    .slice(0, n)
    .map((c) => c.id);
}

export const PLAYERS = {
  ch2: () => ({ onPrompt: firstOption }),
  /** Places the bench under the crooked tree as soon as the runner takes a verb. */
  ch3: () => {
    let placed = false;
    return {
      onTick(_tick, runner) {
        if (!placed) placed = runner.verb({ verb: 'place', x: bench.x, y: bench.y });
      },
    };
  },
  i3: finishes('0'),
  /** Shines on Krit every 40 ticks; answers the bet with its first option. */
  ch4: () => {
    let next = 0;
    return {
      onPrompt: firstOption,
      onTick(tick, runner, lite) {
        const krit = creature(lite, 'krit');
        if (krit && tick >= next && runner.verb({ verb: 'shine', x: krit.x, y: krit.y })) next = tick + 40;
      },
    };
  },
  i4: finishes('done'),
  /** Threads Echo to Pim and to the six villagers nearest her on its first tick; answers the bet with its first option. */
  ch5: () => {
    let threaded = false;
    return {
      onPrompt: firstOption,
      onTick(_tick, runner, lite) {
        if (threaded) return;
        threaded = true;
        for (const b of ['pim', ...nearestVillagers(lite, 'echo', 6)])
          runner.verb({ verb: 'thread', a: 'echo', b, on: true });
      },
    };
  },
  i5: finishes('done'),
  /** Paints fog three times at the Echo and Krit midpoint, on its first three ticks; answers the bet with its first option. */
  ch6: () => {
    let painted = 0;
    return {
      onPrompt: firstOption,
      onTick(_tick, runner, lite) {
        const echo = creature(lite, 'echo');
        const krit = creature(lite, 'krit');
        if (painted >= 3 || !echo || !krit) return;
        const at = { x: (echo.x + krit.x) / 2, y: (echo.y + krit.y) / 2 };
        if (runner.verb({ verb: 'fog', ...at, clear: false })) painted += 1;
      },
    };
  },
  /** Blows from Wisp by (400, 0) on its first tick. */
  ch7: () => {
    let blown = false;
    return {
      onTick(_tick, runner, lite) {
        const wisp = creature(lite, 'wisp');
        if (!blown && wisp) blown = runner.verb({ verb: 'blow', x: wisp.x, y: wisp.y, dx: 400, dy: 0 });
      },
    };
  },
  i7: finishes('done'),
  /** Answers the bet with its first option, and nothing else. */
  ch8: () => ({ onPrompt: firstOption }),
  i8: finishes('done'),
  /** Places a bridge at (810, 300) and one at (810, 600), as soon as the runner takes them. */
  ch9: () => {
    const bridges = [
      { x: 810, y: 300 },
      { x: 810, y: 600 },
    ];
    return {
      onTick(_tick, runner) {
        const at = bridges[0];
        if (at && runner.verb({ verb: 'place', ...at })) bridges.shift();
      },
    };
  },
  ch10: finishes('heard'),
  bridge: finishes(heroResult('lantern', 'Test')),
  fen: walksToTove(true),
} satisfies Record<string, () => ScriptedPlayer>;
