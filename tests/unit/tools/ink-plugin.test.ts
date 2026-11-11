import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import story from '../../../content/ink/main.ink';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { createInk } from '../../../src/story/ink.ts';
import { compileInk } from '../../../tools/ink-plugin.ts';

const CHAPTERS = join(import.meta.dirname, '../../../content/chapters');

/** Every knot a chapter config names: beat ink actions, the bet knot, and the close call of a twist. */
function knotsOf(file: string): string[] {
  const ch = ChapterSchema.parse(JSON.parse(readFileSync(join(CHAPTERS, file), 'utf8')));
  const knots: string[] = [];
  for (const beat of ch.beats) for (const a of beat.actions) if ('ink' in a) knots.push(a.ink);
  if (ch.bet) knots.push(ch.bet.knot);
  if (ch.twist) knots.push(`${ch.id}_close_call`);
  return knots;
}

describe('ink plugin', () => {
  test('importing a .ink file returns compiled story JSON that plays', () => {
    expect(typeof story).toBe('string');
    expect(createInk(story).play('ch0_pim_wakes').lines.length).toBeGreaterThan(0);
  });

  test('every knot a chapter config names exists in main.ink', () => {
    const ink = createInk(story);
    for (const file of readdirSync(CHAPTERS).filter((f) => f.endsWith('.json'))) {
      for (const knot of knotsOf(file)) {
        expect(() => ink.play(knot), `${file}: ${knot}`).not.toThrow();
      }
    }
  });

  test('a compile error names the file and the Ink line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ink-'));
    const path = join(dir, 'bad.ink');
    const src = '=== ok ===\nFine.\n-> END\n\n=== bad ===\nText.\n-> nowhere\n';
    writeFileSync(path, src);
    expect(() => compileInk(src, path)).toThrow(/bad\.ink[\s\S]*line 7/);
  });
});
