// The stored carries (ADR 0012 item 1): one seeded headless year, ch3 to ch7. Each carried
// chapter's T3 run starts from its file here; after a content change, rewrite them with `-u`.
import { expect, test } from 'vitest';
import { runYear } from './year.ts';

test('the seed-1 year gives the stored carries', async () => {
  const { carries } = await runYear(1, 'ch7');
  expect(Object.keys(carries)).toEqual(['i3', 'ch4', 'i4', 'ch5', 'i5', 'ch6', 'ch7']);
  for (const [id, carry] of Object.entries(carries))
    await expect(`${JSON.stringify(carry, null, 2)}\n`).toMatchFileSnapshot(`carry/${id}.json`);
});
