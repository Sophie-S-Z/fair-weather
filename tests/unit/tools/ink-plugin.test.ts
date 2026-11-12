import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import story from '../../../content/ink/main.ink';
import { parseBeatTag } from '../../../src/story/beat-tags.ts';
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

  test('an error inside an INCLUDEd file names that file and line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ink-'));
    writeFileSync(join(dir, 'part.ink'), '=== p ===\nText.\n-> nowhere\n');
    const src = 'INCLUDE part.ink\n=== m ===\nHi.\n-> END\n';
    writeFileSync(join(dir, 'main.ink'), src);
    expect(() => compileInk(src, join(dir, 'main.ink'))).toThrow(/part\.ink[\s\S]*line 3/);
  });

  test('chapter scripts: every line is #placeholder or a spec 5.3 voice line, and beat tags parse', () => {
    const voice = new Set([
      '"Want half? I have a whole one!"',
      '"Mine. Probably."',
      '"You first."',
      '"I remember. I always remember."',
      '"What\'s over there?"',
      '"Maybe after you."',
    ]);
    const dir = join(import.meta.dirname, '../../../content/ink');
    for (const f of readdirSync(dir).filter((n) => /^ch\d+\.ink$/.test(n))) {
      for (const raw of readFileSync(join(dir, f), 'utf8').split('\n')) {
        const line = raw.trim();
        if (line === '' || line.startsWith('//') || line.startsWith('===') || line.startsWith('->')) continue;
        const tags = line
          .split('#')
          .slice(1)
          .map((t) => t.trim());
        if (tags.includes('placeholder')) {
          for (const t of tags.filter((x) => x.startsWith('beat:')))
            expect(parseBeatTag(t), `${f}: ${t}`).not.toBeNull();
        } else {
          expect(voice.has(line), `${f}: ${line}`).toBe(true);
        }
      }
    }
  });
});
