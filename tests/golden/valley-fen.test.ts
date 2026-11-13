// T3 (plan task M3.8): over 200 seeds, Murmuration Fen's twist (Tove flies) happens honestly, so
// the close call plays in fewer than 10 runs. The valley fits spec 7.3: the postcard comes after
// 6 to 8 minutes of play at the median, and before the hero joins, the water shows Tove a flying
// crowd that is not there (ADR 0013 item 16).
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import fenScenario from '../../content/scenarios/fen.json';
import flagsJson from '../../content/flags.json';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { byCodeUnit, dist2 } from '../../src/sim/math.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { tuning } from '../../src/story/tuning.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, summarize } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);
/** The render draws a grounded starling's reflection from this perceived share (meadow-view REFLECT_AT). */
const REFLECT_AT = 0.5;
/** Tove's threshold, fixed in the scenario; by day nothing lowers it. */
const TOVE_THRESHOLD = fenScenario.pack.fixed.tove;

/**
 * The share of Tove's fen.neighbors nearest creatures in flight, picked as fen.ts picks them: every
 * other creature not away, by distance and then id.
 */
function realShare(lite: WorldLite, flying: ReadonlySet<string>): number {
  const tove = lite.creatures.find((c) => c.id === 'tove');
  if (!tove) return 0;
  const near = lite.creatures
    .filter((o) => o !== tove && o.state !== 'away')
    .map((o) => ({ o, d: dist2(tove.x, tove.y, o.x, o.y) }))
    .sort((p, q) => p.d - q.d || byCodeUnit(p.o.id, q.o.id))
    .slice(0, tuning.fen.neighbors);
  return near.length === 0 ? 0 : near.filter(({ o }) => flying.has(o.id)).length / near.length;
}

/** The water shows Tove a crowd in flight (her reflection) while too few of her neighbors really fly to lift her. */
function reflectionMisleads(lite: WorldLite): boolean {
  if (lite.pack?.id !== 'fen') return false;
  const flying = new Set(lite.pack.flying);
  return (lite.pack.perceived.tove ?? 0) >= REFLECT_AT && realShare(lite, flying) < TOVE_THRESHOLD;
}

/** The median of 200 values. */
function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return ((sorted[99] ?? 0) + (sorted[100] ?? 0)) / 2;
}

test('T3 fen: fewer than 10 close calls, the postcard at 6 to 8 minutes, and the reflection misleads Tove in 180 of 200', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  const seconds: number[] = [];
  const shares: number[] = [];
  let misled = 0;
  for (const seed of VALLEY_SEEDS) {
    const player = PLAYERS.fen();
    // Watches each snapshot before the twist while the hero has not joined, so only the water counts.
    const seen = { watched: 0, misled: 0 };
    const watched: ScriptedPlayer = {
      ...player,
      onTick(tick, runner, lite) {
        const pack = lite.pack;
        if (pack?.id === 'fen' && !pack.flying.includes('tove') && !pack.flying.includes('hero')) {
          seen.watched += 1;
          if (reflectionMisleads(lite)) seen.misled += 1;
        }
        player.onTick?.(tick, runner, lite);
      },
    };
    const r = await runChapterHeadless(fen, seed, watched, flags, undefined, undefined, JOURNEY);
    runs.push(r);
    const sent = r.log.find((e) => e.kind === 'postcard');
    if (!sent) throw new Error(`fen seed ${String(seed)} sent no postcard`);
    seconds.push(sent.tick / tuning.sim.stepsPerSecond);
    if (seen.misled > 0) misled += 1;
    shares.push(seen.watched === 0 ? 0 : seen.misled / seen.watched);
  }
  const s = summarize(runs);
  const postcard = median(seconds);
  console.log(
    `T3 fen: ${JSON.stringify(s)}, postcard median ${String(postcard)} s, the reflection misleads Tove in ` +
      `${String(misled)}, on a median ${median(shares).toFixed(3)} of the watched snapshots`,
  );
  expect(s.closeCalls).toBeLessThan(10);
  expect(postcard).toBeGreaterThanOrEqual(360);
  expect(postcard).toBeLessThanOrEqual(480);
  expect(misled).toBeGreaterThanOrEqual(180);
}, 900_000); // 200 runs to day 1's dusk at 405 s: near the t3 project's 600-s default
