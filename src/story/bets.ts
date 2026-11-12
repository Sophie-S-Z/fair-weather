// Bet measures (spec 10.4) read from a snapshot (ADR 0011 item 3). They only read the world.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { MetricSpec } from '../sim/metrics.ts';

/** The share of the creatures not away, `about` left out, that hold the latest rumor; 0 with none. */
export function rumorShare(lite: WorldLite): number {
  const rumor = lite.rumor;
  if (!rumor) return 0;
  const n = lite.creatures.filter((c) => c.state !== 'away' && c.id !== rumor.about).length;
  return n === 0 ? 0 : rumor.holders.length / n;
}

/** How warm `from` is toward `to`; 0 when they have no tie. */
export function warmth(lite: WorldLite, from: string, to: string): number {
  for (const t of lite.ties) {
    if (t.a === from && t.b === to) return t.ab;
    if (t.a === to && t.b === from) return t.ba;
  }
  return 0;
}

/** Among the bet's options only, the id with the highest `value`; a tie goes to the lower id by code unit. */
function maxOver(
  lite: WorldLite,
  options: readonly string[],
  value: (c: WorldLite['creatures'][number]) => number,
): string {
  let best: { id: string; v: number } | undefined;
  for (const c of lite.creatures) {
    if (!options.includes(c.id)) continue;
    const v = value(c);
    if (!best || v > best.v || (v === best.v && c.id < best.id)) best = { id: c.id, v };
  }
  return best?.id ?? '';
}

function measure(m: MetricSpec, lite: WorldLite, options: readonly string[]): string | number {
  switch (m.kind) {
    case 'maxBerries':
      return maxOver(lite, options, (c) => c.berries);
    case 'maxShell':
      return maxOver(lite, options, (c) => c.shell[m.shell]);
    case 'averageWarmth':
      return lite.metrics.averageWarmth;
    case 'friendPairs':
      return lite.metrics.friendPairs;
    case 'rumorShare':
      return rumorShare(lite);
    case 'warmth':
      return warmth(lite, m.from, m.to);
    case 'awayCount':
      return lite.creatures.filter((c) => c.state === 'away').length;
  }
}

/**
 * maxBerries and maxShell answer an option id (only an option, so always one the player could
 * pick), or '' when no option is in the snapshot. The others measure a number; with `buckets`
 * (low to high, one fewer than the options) the answer is the option at index "count of buckets
 * at or below the value" (ADR 0012 item 14).
 */
export function measureBet(
  m: MetricSpec,
  lite: WorldLite,
  options: readonly string[],
  buckets?: readonly number[],
): string | number {
  const value = measure(m, lite, options);
  if (typeof value === 'string' || !buckets) return value;
  return options[buckets.filter((b) => b <= value).length] ?? '';
}
