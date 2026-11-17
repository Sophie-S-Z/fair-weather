import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { buildSnippets } from '../../../snippets/build.ts';

const share = join(import.meta.dirname, '../../../snippets/share');

test('the shared snippet files match their sources (run npm run snippets)', async () => {
  const built = await buildSnippets();
  expect(readdirSync(share).sort()).toEqual([...built.keys()].sort());
  for (const [name, html] of built) expect(readFileSync(join(share, name), 'utf8'), name).toBe(html);
}, 60_000);
