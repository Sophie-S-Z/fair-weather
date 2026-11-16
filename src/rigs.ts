// Every body's rig by id, loaded from content/ for the game and the dev pages alike.
import bodiesJson from '../content/bodies.json';
import { RigSchema, type Rig } from './render/line/rig.ts';

const rigFiles = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });

/** Each rig under its own id, and each villager's id under the shared body it wears (spec 5.4). */
export const rigs = new Map<string, Rig>([
  ...Object.values(rigFiles).map((json): [string, Rig] => {
    const rig = RigSchema.parse(json);
    return [rig.id, rig];
  }),
  ...Object.entries(bodiesJson).flatMap(([id, body]): [string, Rig][] => {
    const rig = rigFiles[`../content/rigs/${body}.rig.json`];
    return rig ? [[id, RigSchema.parse(rig)]] : [];
  }),
]);
