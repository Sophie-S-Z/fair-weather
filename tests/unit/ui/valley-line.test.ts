import { describe, expect, it } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { displayName } from '../../../src/story/names.ts';
import { valleyLine } from '../../../src/ui/valley-line.ts';
import { lite } from '../render/lite-fixture.ts';

type Pack = NonNullable<WorldLite['pack']>;
const HERO: NonNullable<WorldLite['hero']> = {
  kind: 'bellchime',
  name: 'Fennel',
  reply: 'toward',
  gift: 'give',
  keepsakes: [],
  opinions: {},
};

/** Six starlings (one away), a villager, and the hero, in the given pack. */
function world(pack: Pack): WorldLite {
  const w = lite([['tove'], ['s1'], ['s2'], ['s3'], ['s4'], ['gone', 'away'], ['pim'], ['hero']], []);
  for (const c of w.creatures) if (c.id !== 'pim' && c.id !== 'hero') c.speciesId = 'starling';
  return { ...w, pack, hero: HERO };
}

describe('valleyLine', () => {
  it('Fen: Tove’s perceived share, and the share of the starlings and the hero (not away) really in flight', () => {
    // Flying: s1, s2, and the joined hero; the away starling and the villager are not counted.
    const fen = world({ id: 'fen', flying: ['s1', 's2', 'hero', 'gone'], perceived: { tove: 0.857 } });
    expect(valleyLine(fen, displayName)).toEqual({
      text: 'The water shows Tove 86% of the flock flying; 50% of the starlings really fly.',
      spoken: 'The water shows Tove about 90% of the flock flying; about 50% of the starlings really fly.',
    });
  });
  it('Fen: the spoken line moves only in steps of 10%', () => {
    const at = (tove: number, flying: string[]) =>
      valleyLine(world({ id: 'fen', flying, perceived: { tove } }), displayName)?.spoken;
    expect(at(0.14, ['s1'])).toBe(at(0.12, ['s2']));
    expect(at(0.14, ['s1'])).toBe(
      'The water shows Tove about 10% of the flock flying; about 20% of the starlings really fly.',
    );
  });
  it('Fen: 0% with no flock and no reflection', () => {
    const empty = { ...lite([], []), pack: { id: 'fen', flying: [], perceived: {} } } satisfies WorldLite;
    expect(valleyLine(empty, displayName)?.text).toBe(
      'The water shows Tove 0% of the flock flying; 0% of the starlings really fly.',
    );
  });
  it('Hollow: nothing before the first print; then the front page, the hero by its own name', () => {
    expect(valleyLine(world({ id: 'hollow', fame: {}, front: null }), displayName)).toEqual({
      text: '',
      spoken: '',
    });
    expect(valleyLine(world({ id: 'hollow', fame: {}, front: 'quill' }), displayName)?.text).toBe(
      'The gazette: Quill is on the front page.',
    );
    expect(valleyLine(world({ id: 'hollow', fame: {}, front: 'hero' }), displayName)).toEqual({
      text: 'The gazette: Fennel is on the front page.',
      spoken: 'The gazette: Fennel is on the front page.',
    });
  });
  it('nothing in Halcyon or a world without a pack', () => {
    expect(valleyLine(world({ id: 'halcyon', chose: null }), displayName)).toBeNull();
    expect(valleyLine(lite([['pim']], []), displayName)).toBeNull();
    expect(valleyLine(null, displayName)).toBeNull();
  });
});
