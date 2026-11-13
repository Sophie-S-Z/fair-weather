// Save slots (spec 15.1): three manual slots and an autosave that keeps the one before it.
import { openDb } from './db.ts';
import type { Db } from './db.ts';
import type { SaveV2 } from './format.ts';
import { migrate } from './migrations.ts';

export type Slot = 0 | 1 | 2 | 'auto';
export interface SlotInfo {
  slot: Slot;
  chapterId: string;
}

export interface Slots {
  list(): Promise<SlotInfo[]>;
  /** True when the autosave loads: written, not damaged, and its year not kept. */
  hasAuto(): Promise<boolean>;
  save(slot: Slot, s: SaveV2): Promise<void>;
  /**
   * A damaged autosave falls back to the one before it; a damaged manual slot gives null. An
   * autosave whose year is kept gives null.
   */
  load(slot: Slot): Promise<SaveV2 | null>;
  /** Marks the autosave's year as kept in the Book of Skies (SaveV2 `yearKept`), so Continue ends. */
  keepYear(): Promise<void>;
}

const SLOTS: Slot[] = [0, 1, 2, 'auto'];
const key = (slot: Slot, previous = false): string => `${String(slot)}${previous ? '-previous' : ''}`;

/**
 * Opens the database. If storage is blocked, or a write fails later, `onUnavailable` is called
 * once and saves are skipped from then on: the game keeps playing without them.
 */
export async function createSlots(
  factory: IDBFactory,
  onUnavailable: () => void = () => undefined,
): Promise<Slots> {
  let db: Db | null = null;
  let told = false;
  const unavailable = (): void => {
    db = null;
    if (!told) {
      told = true;
      onUnavailable();
    }
  };
  try {
    db = await openDb(factory);
  } catch {
    unavailable();
  }

  async function read(k: string): Promise<SaveV2 | null> {
    if (!db) return null;
    try {
      const raw = await db.get(k);
      return raw === undefined ? null : migrate(raw);
    } catch {
      return null; // damaged, or the read failed
    }
  }

  const load = async (slot: Slot): Promise<SaveV2 | null> => {
    const s = (await read(key(slot))) ?? (slot === 'auto' ? await read(key(slot, true)) : null);
    return s?.yearKept ? null : s;
  };

  return {
    hasAuto: async () => (await load('auto')) !== null,
    async list() {
      const out: SlotInfo[] = [];
      for (const slot of SLOTS) {
        const s = await load(slot);
        if (s) out.push({ slot, chapterId: s.chapterId });
      }
      return out;
    },
    async save(slot, s) {
      if (!db) return;
      try {
        const entries: [string, unknown][] = [[key(slot), s]];
        if (slot === 'auto') {
          // Only a latest that still loads is kept as the one before.
          const latest = await read(key(slot));
          if (latest) entries.push([key(slot, true), latest]);
        }
        await db.putAll(entries);
      } catch {
        unavailable();
      }
    },
    load,
    async keepYear() {
      if (!db) return;
      try {
        // The one before stands in for a damaged latest, as in load.
        const latest = (await read(key('auto'))) ?? (await read(key('auto', true)));
        if (latest) await db.putAll([[key('auto'), { ...latest, yearKept: true }]]);
      } catch {
        unavailable();
      }
    },
  };
}
