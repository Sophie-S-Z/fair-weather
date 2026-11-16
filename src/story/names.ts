// How a creature id reads in text.
import councilJson from '../../content/scenarios/council.json' with { type: 'json' };
import fenJson from '../../content/scenarios/fen.json' with { type: 'json' };
import foglightJson from '../../content/scenarios/foglight.json' with { type: 'json' };
import halcyonJson from '../../content/scenarios/halcyon.json' with { type: 'json' };
import hollowJson from '../../content/scenarios/hollow.json' with { type: 'json' };
import m0Json from '../../content/scenarios/m0.json' with { type: 'json' };
import shallowsJson from '../../content/scenarios/shallows.json' with { type: 'json' };

/** Each scenario creature's name by id (spec 5.4: every villager has a name). */
const NAMES: ReadonlyMap<string, string> = new Map(
  [m0Json, fenJson, hollowJson, foglightJson, councilJson, shallowsJson, halcyonJson].flatMap((s) =>
    s.creatures.map((c) => [c.id, c.name] as const),
  ),
);

/** A creature's scenario name; any other id reads with a capital and spaces: `'newcomer-3'` as `'Newcomer 3'`. */
export function displayName(id: string): string {
  return NAMES.get(id) ?? (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, ' ');
}
