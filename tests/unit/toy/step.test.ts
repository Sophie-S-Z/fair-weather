import { describe, expect, it } from 'vitest';
import { drop, moveHeld, pickUp, placeProp, poke, snip, tie, toggleProp } from '../../../src/toy/commands.ts';
import { FLOOR } from '../../../src/toy/geometry.ts';
import { DISCOVERIES } from '../../../src/toy/discoveries/index.ts';
import { step } from '../../../src/toy/step.ts';
import { createTable } from '../../../src/toy/table.ts';
import { CAST_IDS } from '../../../src/toy/types.ts';
import { get, run, table } from './helpers.ts';

const everyone = CAST_IDS.map((id, i) => [id, 150 + i * 110, 480 + (i % 3) * 120] as const);

describe('step', () => {
  it('gives the same table for the same seed and actions', () => {
    const play = () => {
      const t = createTable({ seed: 3, cast: everyone });
      for (let k = 0; k < 300; k++) {
        if (k === 40) poke(t, 'pim');
        step(t, DISCOVERIES);
      }
      return t.critters.map((c) => [c.x, c.y]);
    };
    expect(play()).toEqual(play());
  });

  it('wanders on the main table and keeps everyone on the floor', () => {
    const t = createTable({ seed: 3, cast: everyone });
    const start = t.critters.map((c) => [c.x, c.y]);
    run(t, 20);
    expect(t.critters.map((c) => [c.x, c.y])).not.toEqual(start);
    for (const c of t.critters) {
      expect(c.x).toBeGreaterThanOrEqual(FLOOR.left);
      expect(c.x).toBeLessThanOrEqual(FLOOR.right);
      expect(c.y).toBeGreaterThanOrEqual(FLOOR.top);
      expect(c.y).toBeLessThanOrEqual(FLOOR.bottom);
    }
  });

  it('does not move a held creature', () => {
    const t = createTable({ seed: 3, cast: everyone });
    pickUp(t, 'krit');
    moveHeld(t, 700, 600);
    run(t, 5);
    expect([get(t, 'krit').x, get(t, 'krit').y]).toEqual([700, 600]);
  });

  it('pushes apart two creatures dropped side by side', () => {
    const t = table({
      cast: [
        ['pim', 800, 600],
        ['krit', 900, 600],
      ],
    });
    pickUp(t, 'krit');
    moveHeld(t, 845, 600);
    drop(t);
    run(t, 5);
    expect(Math.abs(get(t, 'krit').x - get(t, 'pim').x)).toBeGreaterThan(55);
  });
});

describe('player actions', () => {
  it('clamps a drag to the floor', () => {
    const t = table({ cast: [['pim', 800, 600]] });
    pickUp(t, 'pim');
    moveHeld(t, -500, 5000);
    drop(t);
    expect([get(t, 'pim').x, get(t, 'pim').y]).toEqual([FLOOR.left, FLOOR.bottom]);
  });

  it('makes both creatures complain when one lands on the other', () => {
    const t = table({
      cast: [
        ['pim', 800, 600],
        ['krit', 300, 600],
      ],
    });
    pickUp(t, 'krit');
    moveHeld(t, 805, 600);
    drop(t);
    expect(get(t, 'krit').bubble?.icon).toBe('storm');
    expect(get(t, 'pim').bubble?.icon).toBe('storm');
  });

  it('cannot lift a creature in a scene', () => {
    const t = table({ cast: [['pim', 800, 600]] });
    get(t, 'pim').busy = true;
    expect(pickUp(t, 'pim')).toBe(false);
  });

  it('ties once, refuses a self tie, and snips', () => {
    const t = table({
      cast: [
        ['pim', 800, 600],
        ['krit', 300, 600],
      ],
    });
    expect(tie(t, 'pim', 'krit')).toBe(true);
    expect(tie(t, 'krit', 'pim')).toBe(false);
    expect(tie(t, 'pim', 'pim')).toBe(false);
    expect(snip(t, 'krit', 'pim')).toBe(true);
    expect(t.ties).toEqual([]);
  });

  it('smudges Bell on a poke', () => {
    const t = table({ cast: [['bell', 800, 600]] });
    poke(t, 'bell');
    expect(get(t, 'bell').smudge).toBe(true);
  });

  it('places each prop once and flips only the lever and the lamp', () => {
    const t = table({ cast: [] });
    const a = placeProp(t, 'lamp');
    expect(placeProp(t, 'lamp')).toBe(a);
    toggleProp(t, 'lamp');
    expect(a.on).toBe(true);
    const cookie = placeProp(t, 'cookie');
    toggleProp(t, 'cookie');
    expect(cookie.on).toBe(false);
  });

  it('sticks a creature dropped in the puddle until lifted', () => {
    const t = table({ cast: [['pim', 300, 600]] });
    const puddle = placeProp(t, 'puddle');
    pickUp(t, 'pim');
    moveHeld(t, puddle.x, puddle.y);
    drop(t);
    expect(get(t, 'pim').stuck).toBe(true);
    pickUp(t, 'pim');
    expect(get(t, 'pim').stuck).toBe(false);
  });
});
