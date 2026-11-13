// T3 control for Murmuration Fen (plan task M3.8): joining, not time alone, makes Tove fly. Its own
// file so vitest runs it beside valley-fen.test.ts.
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import fenScenario from '../../content/scenarios/fen.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { walksToTove } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);
const RESTLESS = new Set(fenScenario.pack.restless);
/** The window opens on the snapshot of tick 1, and with no retries the close call comes at its end. */
const CLOSE_BY = 1 + (fen.twist?.withinDays ?? 0) * chapterTicksPerDay(fen);

// The same walk to Tove, never joining. With no retries (ADR 0013 item 16) the run is the first
// window only: Tove may fly in at most 20 of 200. Each close call comes at that window's end, and
// before it no starling but the restless ones flies, so the close-call line (content/ink/fen.ink)
// says only that too few near Tove flew.
test('T3 fen control: a hero that never joins sees Tove fly in at most 20 of 200 seeds, and its close call comes in one window with nothing risen', async () => {
  const flags = parseFlags(flagsJson);
  let fired = 0;
  let late = 0;
  let rose = 0;
  for (const seed of VALLEY_SEEDS) {
    const walks = walksToTove(false)();
    // An object, as run-chapter.ts keeps its run: a plain `let` set in a callback looks constant here.
    const seen = { risen: false };
    const player: ScriptedPlayer = {
      ...walks,
      onTick(tick, runner, lite) {
        walks.onTick?.(tick, runner, lite);
        if (lite.pack?.id === 'fen' && !runner.log.some((e) => e.kind === 'twist' && e.tick < tick))
          seen.risen ||= lite.pack.flying.some((id) => id !== 'hero' && !RESTLESS.has(id));
      },
    };
    const r = await runChapterHeadless(fen, seed, player, flags, undefined, undefined, JOURNEY);
    const twist = r.log.find((e) => e.kind === 'twist');
    if (r.twistFired) fired += 1;
    else {
      if (!twist || twist.retries !== 0 || twist.tick > CLOSE_BY) late += 1;
      if (seen.risen) rose += 1;
    }
  }
  console.log(
    `T3 fen control: fired ${String(fired)}, late close calls ${String(late)}, risen ${String(rose)}`,
  );
  expect(fired).toBeLessThanOrEqual(20);
  expect(late).toBe(0);
  expect(rose).toBe(0);
}, 1_200_000); // 200 whole 540-s days: longer than the t3 project's 600-s default
