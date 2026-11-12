// The year log as myth features (spec 10.6 item 1).
import type { Behavior, Tuning } from '../sim/types.ts';
import type { YearLog, YearEvent } from '../story/action-log.ts';
import type { Flags } from '../story/flags.ts';
import type { VerbInput } from '../story/verbs.ts';

export interface MythFeatures {
  /** The share of lit meetings with an `against` or a `keep`; 0 with none. */
  lightOnConflict: number;
  /** The share of lit meetings with a `toward` or a `give`; 0 with none. A meeting can count toward both. */
  lightOnKindness: number;
  /** Sky bids the player turned against. */
  rumbles: number;
  /** Fog painted, as a share of the scene area; clearing does not take it back. */
  fogPainted: number;
  gusts: number;
  /** Creatures that arrived. */
  welcomes: number;
  /** The creature in the most lit meetings, a tie to the lower id; null with none. */
  mostLit: string | null;
  winterLeft: number;
  mossShared: boolean;
  bellDanced: boolean;
  festivalShare: number;
  wispPushed: boolean;
  /** The creature with the highest sky warmth, a tie to the lower id; Pim with no creatures. */
  narrator: string;
}

/**
 * The share of the scene one fog brush stroke paints, from the parsed tuning: myth may not import
 * the sim's TuningSchema (spec 14.2), so the caller passes it to extractFeatures.
 */
export function brushShare(t: Pick<Tuning, 'fog' | 'scene'>): number {
  const r = t.fog.brushRadius;
  return (Math.PI * r * r * t.fog.brushAmount) / (t.scene.width * t.scene.height);
}

/** The id with the highest score, a tie to the lower id; null with no ids. */
function top(scores: Iterable<[string, number]>): string | null {
  let best: [string, number] | null = null;
  for (const [id, score] of scores)
    if (best === null || score > best[1] || (score === best[1] && id < best[0])) best = [id, score];
  return best?.[0] ?? null;
}

export function extractFeatures(
  year: YearLog,
  flags: Flags,
  skyWarmth: Readonly<Record<string, number>>,
  /** brushShare of the tuning. */
  fogShare: number,
): MythFeatures {
  const entries = year.flatMap((c) => c.log);
  const verbs: VerbInput[] = entries.flatMap((e) => (e.kind === 'verb' ? [e.input] : []));
  const events: YearEvent[] = entries.flatMap((e) => (e.kind === 'event' ? [e.e] : []));
  const lit = events.flatMap((e) => (e.t === 'lit' ? [e] : []));
  const share = (kinds: readonly Behavior[]): number =>
    lit.length === 0 ? 0 : lit.filter((e) => e.behaviors.some((b) => kinds.includes(b))).length / lit.length;
  const litCount = new Map<string, number>();
  for (const e of lit) for (const id of [e.a, e.b]) litCount.set(id, (litCount.get(id) ?? 0) + 1);
  return {
    lightOnConflict: share(['against', 'keep']),
    lightOnKindness: share(['toward', 'give']),
    rumbles: verbs.filter((v) => v.verb === 'respond' && v.reply === 'against').length,
    fogPainted: verbs.filter((v) => v.verb === 'fog' && !v.clear).length * fogShare,
    gusts: verbs.filter((v) => v.verb === 'blow').length,
    welcomes: events.filter((e) => e.t === 'arrive').length,
    mostLit: top(litCount),
    winterLeft: flags.winterLeft,
    mossShared: flags.mossShared,
    bellDanced: flags.bellDanced,
    festivalShare: flags.festivalShare,
    wispPushed: flags.wispPushed,
    narrator: top(Object.entries(skyWarmth)) ?? 'pim',
  };
}
