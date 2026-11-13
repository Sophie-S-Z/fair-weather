// main.ts lists the chapters in play order: tests/golden/year.ts CHAPTER_ORDER, then Part 2.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHAPTER_ORDER } from './year.ts';

test("main.ts's chapter list follows CHAPTER_ORDER, then the bridge, the valleys, and home", () => {
  const src = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
  const file = new Map(
    [...src.matchAll(/^import (\w+) from '\.\.\/content\/(?:chapters|valleys)\/(\w+)\.json';$/gm)].map(
      (m) => [m[1], m[2]],
    ),
  );
  const list = (/const chapters = \[([^\]]*)\]/.exec(src)?.[1] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '') // a trailing comma
    .map((v) => file.get(v));
  expect(list).toEqual([...CHAPTER_ORDER, 'bridge', 'fen', 'hollow', 'halcyon', 'home']);
});
