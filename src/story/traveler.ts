// Travelers (ADR 0015 item 9): a sandbox creature as its traveler code holds it, with no free text,
// and the creature it becomes at the gate of the valley that welcomes it.
import { z } from 'zod';
import councilJson from '../../content/scenarios/council.json' with { type: 'json' };
import fenJson from '../../content/scenarios/fen.json' with { type: 'json' };
import foglightJson from '../../content/scenarios/foglight.json' with { type: 'json' };
import halcyonJson from '../../content/scenarios/halcyon.json' with { type: 'json' };
import hollowJson from '../../content/scenarios/hollow.json' with { type: 'json' };
import m0Json from '../../content/scenarios/m0.json' with { type: 'json' };
import shallowsJson from '../../content/scenarios/shallows.json' with { type: 'json' };
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Dials, Scenario, Shell } from '../sim/types.ts';
import { DIALS_SHAPE, SHELL_SHAPE } from './carry.ts';
import { DIARY } from './diary.ts';
import type { Diary, Memory } from './diary.ts';
import { displayName } from './names.ts';
import { tuning } from './tuning.ts';

/** The most travelers a sandbox welcomes, and the most memories a traveler brings. */
export const MAX_TRAVELERS = 3;
export const MAX_MEMORIES = 20;

/** Each creature of the sandbox valleys' bases (Kith's is m0) with its species: a closed set of ids. */
export const BASE_CREATURES: ReadonlyMap<string, string> = new Map(
  [m0Json, fenJson, hollowJson, foglightJson, councilJson, shallowsJson, halcyonJson].flatMap((s) =>
    s.creatures.map((c) => [c.id, c.speciesId] as const),
  ),
);

export interface Traveler {
  /** The base creature it was: its name and its species come from this id. */
  home: string;
  dials: Dials;
  shell: Shell;
  skyWarmth: number;
  /** Its last diary lines, oldest first, at most MAX_MEMORIES; each other is a base creature. */
  memories: Memory[];
}

const ONE_LINE: ReadonlySet<keyof Diary> = new Set(['leave', 'return', 'dance']);
const baseId = z.string().refine((id) => BASE_CREATURES.has(id));
const keys = Object.keys(DIARY) as [keyof Diary, ...(keyof Diary)[]];

/** A traveler as a code holds it: strict, ids from the closed base set, every number bounded. */
export const TravelerSchema = z.strictObject({
  home: baseId,
  dials: z.strictObject(DIALS_SHAPE),
  shell: z.strictObject(SHELL_SHAPE),
  skyWarmth: z.number().min(-1).max(1),
  memories: z
    .array(
      z
        .strictObject({ key: z.enum(keys), other: baseId.exactOptional() })
        .refine(
          (m) => ONE_LINE.has(m.key) === (m.other === undefined),
          'A line names another only when its template does',
        ),
    )
    .max(MAX_MEMORIES),
}) satisfies z.ZodType<Traveler>;

/** The id the `i`-th welcomed traveler (from 0) has in the valley. */
export const travelerId = (i: number): string => `traveler-${String(i + 1)}`;

/** The base creature `id` was: itself, or a welcomed traveler's home; null for a newcomer. */
export function homeOf(id: string, travelers: readonly Traveler[]): string | null {
  const m = /^traveler-([0-9])$/.exec(id);
  if (m) return travelers[Number(m[1]) - 1]?.home ?? null;
  return BASE_CREATURES.has(id) ? id : null;
}

/** How `id` reads in the sandbox: a traveler by its home's name. */
export const travelerName = (id: string, travelers: readonly Traveler[]): string =>
  displayName(id.startsWith('traveler-') ? (homeOf(id, travelers) ?? id) : id);

/**
 * The traveler `c` is now, with `memories` cut to its last MAX_MEMORIES that name no other or a base
 * creature; null for a creature with no home (a newcomer).
 */
export function travelerOf(
  c: WorldLite['creatures'][number],
  memories: readonly Memory[],
  travelers: readonly Traveler[],
): Traveler | null {
  const home = homeOf(c.id, travelers);
  if (home === null) return null;
  return {
    home,
    dials: { ...c.dials },
    shell: { ...c.shell },
    skyWarmth: c.skyWarmth,
    memories: memories
      .filter((m) => m.other === undefined || BASE_CREATURES.has(m.other))
      .slice(-MAX_MEMORIES)
      .map((m) => ({ ...m })),
  };
}

/** `t` as the `i`-th welcomed creature: at the gate, with no berries, its home's name and species. */
export function travelerCreature(t: Traveler, i: number): Scenario['creatures'][number] {
  return {
    id: travelerId(i),
    speciesId: BASE_CREATURES.get(t.home) ?? tuning.population.newcomerSpecies,
    name: displayName(t.home),
    x: tuning.scene.gateX,
    y: tuning.scene.gateY,
    berries: 0,
    dials: { ...t.dials },
    shell: { ...t.shell },
    skyWarmth: t.skyWarmth,
  };
}
