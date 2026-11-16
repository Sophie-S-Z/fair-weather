import { expect, test } from 'vitest';
import type { KeptLink } from '../../../src/persist/profile.ts';
import { remixTree } from '../../../src/ui/remix-tree.ts';

const kept = (id: string, from: string[] = []): KeptLink => ({
  id,
  from,
  valley: 'fen',
  day: 0,
  text: `v1.${id}`,
});
const ids = (nodes: ReturnType<typeof remixTree>['own']): unknown =>
  nodes.map((n) => (n.children.length > 0 ? { [n.link.id]: ids(n.children) } : n.link.id));

test('each link goes under the newest kept link in its lineage; a link with no kept parent is someone else’s', () => {
  const tree = remixTree([
    kept('a'),
    kept('b', ['a']),
    kept('c', ['a', 'b']),
    kept('d', ['a', 'gone']),
    kept('e', ['gone']),
    kept('f', ['gone', 'e']),
  ]);
  expect(ids(tree.own)).toEqual([{ a: [{ b: ['c'] }, 'd'] }]);
  expect(ids(tree.others)).toEqual([{ e: ['f'] }]);
});
