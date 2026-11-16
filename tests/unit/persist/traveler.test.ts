// Traveler codes (ADR 0015 item 9): a code holds no free text and no id outside the closed sets.
import { expect, test } from 'vitest';
import { MAX_TRAVELER_TEXT, decodeTraveler, encodeTraveler } from '../../../src/persist/traveler.ts';
import { pack } from '../../../src/persist/seed-link.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { DIARY, memoryText } from '../../../src/story/diary.ts';
import type { Memory } from '../../../src/story/diary.ts';
import {
  BASE_CREATURES,
  MAX_MEMORIES,
  homeOf,
  travelerCreature,
  travelerName,
  travelerOf,
} from '../../../src/story/traveler.ts';
import type { Traveler } from '../../../src/story/traveler.ts';
import { tuning } from '../../../src/story/tuning.ts';

const pim = (over: Partial<Traveler> = {}): Traveler => ({
  home: 'pim',
  dials: { opener: 0.6, forgiveness: 0.5, memory: 0.4, ear: 0.5, wanderlust: 0.2 },
  shell: { tightness: 0.3, bristle: 0.1, color: 0.5, softness: 0.7 },
  skyWarmth: 0.25,
  memories: [{ key: 'bid.toward', other: 'krit' }, { key: 'leave' }],
  ...over,
});
/** `value` packed as a code, as encodeTraveler would if the schema let it. */
const raw = (value: unknown): Promise<string> => pack('t1.', JSON.stringify(value));

test('a traveler round-trips through its code, and spaces from a paste are cut', async () => {
  const code = await encodeTraveler(pim());
  expect(code).toMatch(/^t1\.[A-Za-z0-9_-]+$/);
  expect(await decodeTraveler(code)).toEqual(pim());
  expect(await decodeTraveler(`  ${code}\n`)).toEqual(pim());
});

test('decode gives null for a seed link, a cut code, a long text, and JSON encode would not write', async () => {
  const code = await encodeTraveler(pim());
  expect(await decodeTraveler(code.replace('t1.', 'v1.'))).toBeNull();
  expect(await decodeTraveler(code.slice(0, -3))).toBeNull();
  expect(await decodeTraveler(`t1.${'A'.repeat(MAX_TRAVELER_TEXT)}`)).toBeNull();
  expect(await decodeTraveler(await pack('t1.', JSON.stringify(pim(), null, 1)))).toBeNull();
});

test('a code holds no free text: a name, a caption, a made-up id, or a line from outside the diary', async () => {
  for (const bad of [
    { ...pim(), name: 'Pim the Great' },
    pim({ home: 'my-friend' }),
    pim({ home: 'newcomer-1' }),
    pim({ memories: [{ key: 'bid.toward', other: 'stranger' }] }),
    pim({ memories: [{ key: 'said', other: 'krit' } as never] }),
    pim({ memories: [{ key: 'leave', other: 'krit' }] }),
    pim({ memories: [{ key: 'bid.away' }] }),
    pim({ memories: Array.from({ length: MAX_MEMORIES + 1 }, () => ({ key: 'dance' as const })) }),
    pim({ skyWarmth: 2 }),
    pim({ dials: { ...pim().dials, opener: -0.1 } }),
  ]) {
    expect(await decodeTraveler(await raw(bad)), JSON.stringify(bad)).toBeNull();
    await expect(encodeTraveler(bad)).rejects.toThrow();
  }
});

const lite = (id: string): WorldLite['creatures'][number] => ({
  id,
  speciesId: 'villager',
  x: 0,
  y: 0,
  state: 'wander',
  shell: pim().shell,
  berries: 2,
  skyWarmth: 0.25,
  dials: pim().dials,
  dancing: false,
  gone: false,
});

test("a creature's traveler keeps its home, drops lines about others with no home, and keeps the last 20", () => {
  const travelers = [pim({ home: 'krit' })];
  const lines: Memory[] = [
    { key: 'bid.toward', other: 'newcomer-4' },
    ...Array.from({ length: MAX_MEMORIES }, (): Memory => ({ key: 'gift.got.give', other: 'echo' })),
    { key: 'dance' },
  ];
  const t = travelerOf(lite('traveler-1'), lines, travelers);
  expect(t?.home).toBe('krit');
  expect(t?.memories).toHaveLength(MAX_MEMORIES);
  expect(t?.memories.at(-1)).toEqual({ key: 'dance' });
  expect(t?.memories.some((m) => m.other === 'newcomer-4')).toBe(false);
  expect(travelerOf(lite('newcomer-2'), [], travelers)).toBeNull();
  expect(homeOf('traveler-2', travelers)).toBeNull();
  expect(travelerName('traveler-1', travelers)).toBe('Krit');
  expect(travelerName('pim', travelers)).toBe('Pim');
});

test("a welcomed traveler stands at the gate with its home's name and species and no berries", () => {
  const c = travelerCreature(pim({ home: 'brume' }), 1);
  expect(c).toMatchObject({
    id: 'traveler-2',
    name: 'Brume',
    speciesId: BASE_CREATURES.get('brume'),
    x: tuning.scene.gateX,
    y: tuning.scene.gateY,
    berries: 0,
  });
  expect(c.speciesId).toBe('snail');
  expect(memoryText({ key: 'bid.toward', other: 'krit' }, DIARY)).toContain('Krit');
});
