import type { WorldLite } from '../../../src/sim-host/protocol.ts';

type State = WorldLite['creatures'][number]['state'];

/**
 * A hand-built snapshot: creatures as [id, state?, x?, y?] and ties as [a, b, ab, ba]. The
 * creatures stand 100 units apart along y = 400 unless placed.
 */
export function lite(
  creatures: [string, State?, number?, number?][],
  ties: [string, string, number, number][],
  averageWarmth = 0,
): WorldLite {
  return {
    creatures: creatures.map(([id, state = 'wander', x, y], i) => ({
      id,
      speciesId: 'kith',
      x: x ?? 100 + 100 * i,
      y: y ?? 400,
      state,
      shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
      berries: 0,
      skyWarmth: 0,
      dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
      dancing: false,
      gone: false,
    })),
    ties: ties.map(([a, b, ab, ba]) => ({ a, b, ab, ba })),
    rumor: null,
    hero: null,
    pack: null,
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth, friendPairs: 0 },
    structures: [],
    bushes: [],
    water: [],
    banks: [],
    decks: [],
    islets: [],
    mushroom: null,
    season: 'spring',
    day: 0,
    gateDark: false,
  };
}
