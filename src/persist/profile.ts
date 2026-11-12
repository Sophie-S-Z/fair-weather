// The profile (spec 10.6 item 7, 13.2): the Book of Skies, one myth page per finished year, and the
// Quiet Visitor's feathers (ADR 0012 item 12). It lives under one key in the save database and
// outlasts every save slot.
import { z } from 'zod';
import type { MythPage } from '../myth/grammar.ts';
import { openDb } from './db.ts';
import type { Db } from './db.ts';

/** A kept myth: `year` counts the finished years from 1, and `seed` is the valley's seed. */
export interface BookPage extends MythPage {
  year: number;
  seed: number;
}

export interface Profile {
  /** The pages in the order they were kept. */
  pages(): Promise<BookPage[]>;
  keepMyth(page: MythPage, seed: number): Promise<BookPage>;
  feathers(): Promise<number>;
  /** Counts one more feather and returns the new count. */
  addFeather(): Promise<number>;
}

const KEY = 'profile';

const ProfileSchema = z.object({
  pages: z.array(
    z.object({
      narrator: z.string(),
      verses: z.array(z.object({ title: z.string(), text: z.string(), note: z.string().nullable() })),
      year: z.number().int().positive(),
      seed: z.number(),
    }),
  ),
  feathers: z.number().int().nonnegative(),
}) satisfies z.ZodType<{ pages: BookPage[]; feathers: number }>;

type Data = z.infer<typeof ProfileSchema>;
const empty = (): Data => ({ pages: [], feathers: 0 });
/** Stored data, or empty when there is none or it is damaged. */
const parse = (raw: unknown): Data => {
  const parsed = ProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : empty();
};

/**
 * Opens the profile. Each read goes to the database, and each write reads, changes, and puts the
 * profile in one transaction, so two tabs never erase each other's pages or feathers. Blocked
 * storage, or a read or write that fails, gives a profile kept in memory for this visit, from what
 * was last read, and calls `onUnavailable` once (the save slots' notice). A damaged profile reads
 * as empty.
 */
export async function createProfile(
  factory: IDBFactory,
  onUnavailable: () => void = () => undefined,
): Promise<Profile> {
  let db: Db | null = null;
  let data = empty();
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
  const read = async (): Promise<Data> => {
    if (db) {
      try {
        data = parse(await db.get(KEY));
      } catch {
        unavailable();
      }
    }
    return structuredClone(data);
  };
  /** Applies `change` to the stored profile, or to the one in memory without storage. */
  const write = async (change: (d: Data) => void): Promise<Data> => {
    if (db) {
      try {
        data = await db.update(KEY, (raw) => {
          const d = parse(raw);
          change(d);
          return d;
        });
        return structuredClone(data);
      } catch {
        unavailable();
      }
    }
    change(data);
    return structuredClone(data);
  };
  return {
    pages: async () => (await read()).pages,
    async keepMyth(page, seed) {
      const d = await write((d) => {
        d.pages.push({ ...structuredClone(page), year: d.pages.length + 1, seed });
      });
      const kept = d.pages.at(-1);
      if (!kept) throw new Error('the page was not kept');
      return kept;
    },
    feathers: async () => (await read()).feathers,
    async addFeather() {
      return (
        await write((d) => {
          d.feathers += 1;
        })
      ).feathers;
    },
  };
}
