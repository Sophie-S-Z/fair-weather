// main.ts lists the chapters in play order, which tests/golden/year.ts names as CHAPTER_ORDER.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHAPTER_ORDER } from './year.ts';

test("main.ts's chapter list follows CHAPTER_ORDER", () => {
  const src = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
  const file = new Map(
    [...src.matchAll(/^import (\w+) from '\.\.\/content\/chapters\/(\w+)\.json';$/gm)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  const list = (/const chapters = \[([^\]]*)\]/.exec(src)?.[1] ?? '')
    .split(',')
    .map((v) => file.get(v.trim()));
  expect(list).toEqual(CHAPTER_ORDER.slice(0, list.length));
});
