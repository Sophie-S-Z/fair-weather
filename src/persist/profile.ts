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

/**
 * Opens the profile. Blocked storage, or a write that fails, gives a profile kept in memory for
 * this visit. A damaged profile reads as empty.
 */
export async function createProfile(factory: IDBFactory): Promise<Profile> {
  let db: Db | null = null;
  let data: z.infer<typeof ProfileSchema> = { pages: [], feathers: 0 };
  try {
    db = await openDb(factory);
    const parsed = ProfileSchema.safeParse(await db.get(KEY));
    if (parsed.success) data = parsed.data;
  } catch {
    db = null;
  }
  const write = async (): Promise<void> => {
    if (!db) return;
    try {
      await db.putAll([[KEY, data]]);
    } catch {
      db = null;
    }
  };
  return {
    pages: () => Promise.resolve(structuredClone(data.pages)),
    async keepMyth(page, seed) {
      const kept: BookPage = { ...structuredClone(page), year: data.pages.length + 1, seed };
      data.pages.push(kept);
      await write();
      return structuredClone(kept);
    },
    feathers: () => Promise.resolve(data.feathers),
    async addFeather() {
      data.feathers += 1;
      await write();
      return data.feathers;
    },
  };
}
