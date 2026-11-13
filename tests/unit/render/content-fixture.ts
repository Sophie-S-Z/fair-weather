// The rigs and the cast, read from content once for the render tests.
import { readdirSync, readFileSync } from 'node:fs';
import { CastSchema, type Cast } from '../../../src/render/cast.ts';
import { RigSchema, type Rig } from '../../../src/render/line/rig.ts';

function load<T extends { id: string }>(dir: string, parse: (json: unknown) => T): Map<string, T> {
  return new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const item = parse(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
        return [item.id, item];
      }),
  );
}

/** Every rig in content/rigs, by id. */
export const rigs: Map<string, Rig> = load('content/rigs', (j) => RigSchema.parse(j));
/** Every cast member in content/cast, by id. */
export const cast: Map<string, Cast> = load('content/cast', (j) => CastSchema.parse(j));
