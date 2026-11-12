import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { carryFrom } from '../../../src/story/carry.ts';

const shell = { tightness: 0.1, bristle: 0.2, color: 0.3, softness: 0.4 };
const dials = { opener: 0.2, forgiveness: 0.5, memory: 0.6, ear: 0.7, wanderlust: 0.8 };

test('carryFrom keeps dials, shell, sky warmth, away, gone, and tie warmths', () => {
  const creature = (id: string, state: 'wander' | 'away', gone = false): WorldLite['creatures'][number] => ({
    id,
    x: 10,
    y: 20,
    state,
    shell,
    berries: 3,
    skyWarmth: 0.4,
    dials,
    dancing: true,
    gone,
  });
  const lite: WorldLite = {
    creatures: [creature('pim', 'wander'), creature('krit', 'away'), creature('wisp', 'away', true)],
    ties: [{ a: 'krit', b: 'pim', ab: -0.3, ba: 0.6 }],
    rumor: null,
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth: 0, friendPairs: 0 },
    structures: [{ id: 'bench-1', kind: 'bench', x: 1, y: 1 }],
    water: [],
    mushroom: null,
  };
  const carry = carryFrom(lite);
  expect(carry).toEqual({
    creatures: [
      { id: 'pim', dials, shell, skyWarmth: 0.4, away: false, gone: false },
      { id: 'krit', dials, shell, skyWarmth: 0.4, away: true, gone: false },
      { id: 'wisp', dials, shell, skyWarmth: 0.4, away: true, gone: true },
    ],
    ties: [{ a: 'krit', b: 'pim', ab: -0.3, ba: 0.6 }],
  });
  // Copies, so a scenario built from the carry never shares the snapshot's objects.
  expect(carry.creatures[0]?.dials).not.toBe(dials);
  expect(carry.creatures[0]?.shell).not.toBe(shell);
});
