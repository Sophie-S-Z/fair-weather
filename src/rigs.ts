// Every body's rig by id, loaded from content/.
import { RigSchema, type Rig } from './render/line/rig.ts';

const rigFiles = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });

export const rigs = new Map<string, Rig>(
  Object.values(rigFiles).map((json): [string, Rig] => {
    const rig = RigSchema.parse(json);
    return [rig.id, rig];
  }),
);
