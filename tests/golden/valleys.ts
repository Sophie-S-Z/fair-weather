// The journey the valley T3 runs start from (plan task M3.8): a fresh hero, as if it had just
// crossed the bridge, with nothing carried from an earlier valley.
import fenJson from '../../content/valleys/fen.json';
import type { HeroKind } from '../../src/sim/types.ts';
import type { JourneyStart } from '../../src/story/scenario.ts';
import { SEEDS } from './run-chapter.ts';

/** Seeds 1 to 200. */
export const VALLEY_SEEDS: readonly number[] = SEEDS;

/** A Lantern-bearer named "Test", with no rumor, no keepsakes, no companion, and Kith's warmth at 0.3. */
export const JOURNEY: JourneyStart = {
  kind: 'lantern',
  name: 'Test',
  keepsakes: [],
  rumor: null,
  companion: null,
  kithWarmth: 0.3,
};

/** JOURNEY with the hero of `kind`. */
export function journeyFor(kind: HeroKind): JourneyStart {
  return { ...JOURNEY, kind };
}

/** JOURNEY carrying the Fen's starling feather, as the T3 player reaches Halcyon (spec 7.3), with Kith at `kithWarmth`. */
export function halcyonJourney(kithWarmth: number): JourneyStart {
  return { ...JOURNEY, keepsakes: [fenJson.valley.keepsake.id], kithWarmth };
}

/** JOURNEY with Wisp come home beside the hero, as the Halcyon T3 player brings it. */
export const HOME_JOURNEY: JourneyStart = { ...JOURNEY, companion: 'wisp' };
