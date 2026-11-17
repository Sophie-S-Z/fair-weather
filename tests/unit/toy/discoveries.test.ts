import { describe, expect, it } from 'vitest';
import {
  drop,
  moveHeld,
  pickUp,
  placeProp,
  poke,
  removeProp,
  snip,
  tie,
  toggleProp,
} from '../../../src/toy/commands.ts';
import { cookieMove } from '../../../src/toy/discoveries/game-theory.ts';
import { trackPaths, twinBoxes } from '../../../src/toy/geometry.ts';
import { createTable } from '../../../src/toy/table.ts';
import type { CastId, PropKind } from '../../../src/toy/types.ts';
import { found, get, run, table } from './helpers.ts';

const at = (kind: PropKind, cast: [CastId, number, number][]) => {
  const t = table({ cast });
  return { t, p: placeProp(t, kind) };
};

describe('the cookie standoff', () => {
  it('two grabbers break the cookie and find the standoff', () => {
    const { t, p } = at('cookie', [
      ['krit', 700, 660],
      ['frog', 900, 660],
    ]);
    t.rng.next = () => 0.99;
    const events = run(t, 12);
    expect(found(events)).toEqual(['standoff']);
    expect(t.props.find((q) => q.kind === 'cookie')).toBeUndefined();
    expect(p.count).toBe(0);
  });

  it('does not fire with only one creature near', () => {
    const { t } = at('cookie', [
      ['krit', 700, 660],
      ['pim', 100, 460],
    ]);
    expect(found(run(t, 12))).toEqual([]);
    expect(t.scene).toBeNull();
  });

  it('a poke during the scene makes the creature grab by accident', () => {
    const t = table({ cast: [['pim', 700, 660]] });
    const pim = get(t, 'pim');
    t.rng.next = () => 0;
    expect(cookieMove(t, pim, pim, 0)).toBe('share');
    poke(t, 'pim');
    expect(cookieMove(t, pim, pim, t.time)).toBe('grab');
  });

  it('Echo copies, and Snail never forgives a grab', () => {
    const t = table({
      cast: [
        ['echo', 700, 660],
        ['snail', 900, 660],
        ['krit', 500, 660],
      ],
      memory: { 'krit>echo': 'grab' },
    });
    expect(cookieMove(t, get(t, 'echo'), get(t, 'krit'), -1)).toBe('grab');
    expect(cookieMove(t, get(t, 'echo'), get(t, 'snail'), -1)).toBe('share');
    t.grudges.push('snail>krit');
    expect(cookieMove(t, get(t, 'snail'), get(t, 'krit'), -1)).toBe('grab');
  });

  it('three rounds with Echo find the copycat', () => {
    const t = table({
      cast: [
        ['echo', 700, 660],
        ['pim', 900, 660],
      ],
    });
    const stickers = [];
    for (let round = 0; round < 3; round++) {
      placeProp(t, 'cookie');
      stickers.push(...found(run(t, 12)));
      t.cool = {};
    }
    expect(stickers).toContain('copycat');
  });

  it('ends at once, with no sticker, if the cookie leaves mid scene', () => {
    const { t } = at('cookie', [
      ['krit', 700, 660],
      ['frog', 900, 660],
    ]);
    run(t, 1);
    expect(t.scene?.id).toBe('standoff');
    removeProp(t, 'cookie');
    expect(found(run(t, 1))).toEqual([]);
    expect(t.scene).toBeNull();
    expect(get(t, 'krit').busy).toBe(false);
  });

  it('does not start while a chosen creature is held', () => {
    const { t } = at('cookie', [
      ['krit', 700, 660],
      ['frog', 900, 660],
    ]);
    pickUp(t, 'frog');
    moveHeld(t, 900, 660);
    run(t, 1);
    expect(t.scene).toBeNull();
  });
});

describe('the last berry', () => {
  const eaters: [CastId, number, number][] = [
    ['frog', 1200, 600],
    ['pim', 1300, 600],
    ['krit', 1150, 520],
    ['moss', 1350, 520],
  ];
  it('strangers strip the bush bare', () => {
    const { t, p } = at('bush', eaters);
    expect(found(run(t, 12))).toEqual(['commons']);
    expect(p.on).toBe(false);
  });
  it('friends take turns and leave berries', () => {
    const { t, p } = at('bush', eaters);
    tie(t, 'frog', 'pim');
    tie(t, 'pim', 'krit');
    tie(t, 'krit', 'moss');
    expect(found(run(t, 12))).toEqual(['commons']);
    expect(p.on).toBe(true);
    expect(p.count).toBeGreaterThan(0);
  });
  it('needs four eaters', () => {
    const { t } = at('bush', eaters.slice(0, 3));
    expect(found(run(t, 12))).toEqual([]);
  });
});

describe('psychology', () => {
  it('three at the signpost start a crowd', () => {
    const { t } = at('signpost', [
      ['pim', 540, 520],
      ['krit', 600, 540],
      ['moss', 500, 470],
      ['tove', 1400, 800],
    ]);
    expect(found(run(t, 15))).toEqual(['lookup']);
  });

  it('one onlooker helps, a crowd waits', () => {
    const one = at('puddle', [
      ['pim', 300, 600],
      ['krit', 1100, 640],
    ]);
    pickUp(one.t, 'pim');
    moveHeld(one.t, one.p.x, one.p.y);
    drop(one.t);
    expect(found(run(one.t, 6))).toEqual([]);
    expect(get(one.t, 'pim').stuck).toBe(false);

    const many = at('puddle', [
      ['pim', 300, 600],
      ['krit', 1100, 640],
      ['moss', 950, 700],
      ['bell', 1150, 700],
    ]);
    pickUp(many.t, 'pim');
    moveHeld(many.t, many.p.x, many.p.y);
    drop(many.t);
    expect(found(run(many.t, 15))).toEqual(['bystander']);
  });

  it('a smudged Bell at the mirror finds the spotlight; a clean one does not', () => {
    const cast: [CastId, number, number][] = [
      ['bell', 330, 570],
      ['pim', 700, 600],
      ['krit', 900, 600],
    ];
    const clean = at('mirror', cast);
    expect(found(run(clean.t, 10))).toEqual([]);
    const smudged = at('mirror', cast);
    poke(smudged.t, 'bell');
    expect(found(run(smudged.t, 20))).toEqual(['spotlight']);
    expect(get(smudged.t, 'bell').smudge).toBe(false);
  });
});

describe('philosophy', () => {
  it('a creature in the twin box comes out twice, then once', () => {
    const { t, p } = at('twins', [
      ['glassling', 600, 600],
      ['quill', 800, 500],
    ]);
    pickUp(t, 'glassling');
    moveHeld(t, ...twinBoxes(p).a);
    drop(t);
    run(t, 3);
    expect(t.critters).toHaveLength(3);
    expect(found(run(t, 15))).toEqual(['identity']);
    expect(t.critters).toHaveLength(2);
  });

  it('riders on both branches set the cart going, and the lever picks the branch', () => {
    const t = table({ cast: [] });
    const p = placeProp(t, 'track');
    const { far, near } = trackPaths(p);
    const t2 = createTable({
      seed: 1,
      wander: false,
      cast: [
        ['pim', (far[0] + far[2]) / 2, (far[1] + far[3]) / 2],
        ['krit', (near[0] + near[2]) / 2, (near[1] + near[3]) / 2],
      ],
    });
    t2.props.push({ ...p });
    toggleProp(t2, 'track');
    const events = run(t2, 12);
    expect(found(events)).toEqual(['lever']);
    expect(events.some((e) => e.kind === 'line' && e.text.startsWith('You pulled'))).toBe(true);
  });

  it('a fan cheers the shadows only while the lamp is lit', () => {
    const cast: [CastId, number, number][] = [
      ['moss', 330, 700],
      ['pim', 440, 700],
      ['krit', 390, 860],
    ];
    const dark = at('lamp', cast);
    dark.p.y = 760;
    expect(found(run(dark.t, 10))).toEqual([]);
    const lit = at('lamp', cast);
    lit.p.y = 760;
    toggleProp(lit.t, 'lamp');
    expect(found(run(lit.t, 15))).toEqual(['shadows']);
  });
});

describe('networks', () => {
  const chain: [CastId, number, number][] = [
    ['kite', 300, 600],
    ['pim', 450, 600],
    ['krit', 600, 600],
    ['moss', 750, 600],
  ];
  it('a double poke on Kite sends a whisper down a chain of four', () => {
    const t = table({
      cast: chain,
      ties: [
        ['kite', 'pim'],
        ['pim', 'krit'],
        ['krit', 'moss'],
      ],
    });
    poke(t, 'kite');
    run(t, 0.2);
    poke(t, 'kite');
    expect(found(run(t, 10))).toEqual(['telephone']);
  });
  it('a chain of three is not enough', () => {
    const t = table({
      cast: chain,
      ties: [
        ['kite', 'pim'],
        ['pim', 'krit'],
      ],
    });
    poke(t, 'kite');
    run(t, 0.2);
    poke(t, 'kite');
    expect(found(run(t, 10))).toEqual([]);
  });

  it('snipping the only bridge between two groups of three finds the bridge', () => {
    const t = table({
      cast: [...chain, ['bell', 900, 600], ['tove', 1050, 600]],
      ties: [
        ['kite', 'pim'],
        ['pim', 'krit'],
        ['krit', 'moss'],
        ['moss', 'bell'],
        ['bell', 'tove'],
      ],
    });
    snip(t, 'krit', 'moss');
    expect(found(run(t, 8))).toEqual(['bridge']);
    const t2 = table({
      cast: chain,
      ties: [
        ['kite', 'pim'],
        ['pim', 'krit'],
        ['krit', 'moss'],
      ],
    });
    snip(t2, 'pim', 'krit');
    expect(found(run(t2, 8))).toEqual([]);
  });

  it('a lonely creature poked counts its popular friend', () => {
    const t = table({
      cast: [
        ['pim', 300, 600],
        ['toadstool', 600, 600],
        ['krit', 800, 600],
        ['moss', 800, 700],
        ['bell', 900, 500],
      ],
      ties: [
        ['pim', 'toadstool'],
        ['toadstool', 'krit'],
        ['toadstool', 'moss'],
        ['toadstool', 'bell'],
      ],
    });
    poke(t, 'pim');
    expect(found(run(t, 8))).toEqual(['paradox']);
  });
});
