// T3 (plan task M3.8): over 200 seeds, Murmuration Fen's twist (Tove flies) happens honestly, so
// the close call plays in fewer than 10 runs. The valley fits spec 7.3: the postcard comes after
// 6 to 8 minutes of play at the median, and before the hero joins, the water misleads Tove.
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import flagsJson from '../../content/flags.json';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { tuning } from '../../src/story/tuning.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, summarize } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);

/** Tove's perceived share is above the share of the flock really in flight (the majority illusion). */
function misled(lite: WorldLite): boolean {
  if (lite.pack?.id !== 'fen') return false;
  const flying = new Set(lite.pack.flying);
  const flock = lite.creatures.filter((c) => c.speciesId === 'starling' && c.state !== 'away');
  const real = flock.filter((c) => flying.has(c.id)).length / flock.length;
  return (lite.pack.perceived.tove ?? 0) > real;
}

test('T3 fen: fewer than 10 close calls, the postcard at 6 to 8 minutes, and Tove misled in 180 of 200', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  const seconds: number[] = [];
  let fooled = 0;
  for (const seed of VALLEY_SEEDS) {
    const player = PLAYERS.fen();
    // Watches each snapshot before the twist while the hero has not joined, so only the water counts.
    const seen = { misled: false };
    const watched: ScriptedPlayer = {
      ...player,
      onTick(tick, runner, lite) {
        const pack = lite.pack;
        const before = pack?.id === 'fen' && !pack.flying.includes('tove') && !pack.flying.includes('hero');
        if (before && misled(lite)) seen.misled = true;
        player.onTick?.(tick, runner, lite);
      },
    };
    const r = await runChapterHeadless(fen, seed, watched, flags, undefined, undefined, JOURNEY);
    runs.push(r);
    const sent = r.log.find((e) => e.kind === 'postcard');
    if (!sent) throw new Error(`fen seed ${String(seed)} sent no postcard`);
    seconds.push(sent.tick / tuning.sim.stepsPerSecond);
    if (seen.misled) fooled += 1;
  }
  const s = summarize(runs);
  const sorted = [...seconds].sort((a, b) => a - b);
  const median = ((sorted[99] ?? 0) + (sorted[100] ?? 0)) / 2;
  console.log(
    `T3 fen: ${JSON.stringify(s)}, postcard median ${String(median)} s, Tove misled in ${String(fooled)}`,
  );
  expect(s.closeCalls).toBeLessThan(10);
  expect(median).toBeGreaterThanOrEqual(360);
  expect(median).toBeLessThanOrEqual(480);
  expect(fooled).toBeGreaterThanOrEqual(180);
}, 900_000); // 200 runs to day 1's dusk at 405 s: near the t3 project's 600-s default
