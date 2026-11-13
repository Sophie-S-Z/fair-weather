// T3 control for Murmuration Fen (plan task M3.8): joining, not time alone, makes Tove fly. Its own
// file so vitest runs it beside valley-fen.test.ts.
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { walksToTove } from './players.ts';
import { controlFired } from './run-chapter.ts';
import { JOURNEY } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);

// The same walk to Tove, never joining, first window only: Tove may fly in at most 20 of 200.
test('T3 fen control: a hero that never joins sees Tove fly in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(fen, walksToTove(false), parseFlags(flagsJson), undefined, JOURNEY);
  console.log(`T3 fen control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
}, 900_000); // 200 whole 540-s days: longer than the t3 project's 600-s default
