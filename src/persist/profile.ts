// The profile (spec 10.6 item 7, 13.2): the Book of Skies, one myth page per finished year, and the
// Quiet Visitor's feathers (ADR 0012 item 12). It lives under one key in the save database and
// outlasts every save slot.
import { z } from 'zod';
import type { MythPage } from '../myth/grammar.ts';
import { CarrySchema } from '../story/carry.ts';
import type { Carry } from '../story/carry.ts';
import { cutNote } from '../story/journey.ts';
import { SANDBOX_VALLEYS } from '../story/sandbox.ts';
import type { SandboxValley } from '../story/sandbox.ts';
import { openDb } from './db.ts';
import type { Db } from './db.ts';
import { MAX_LINK_TEXT } from './seed-link.ts';

/** A kept myth: `year` counts the finished years from 1, and `seed` is the valley's seed. */
export interface BookPage extends MythPage {
  year: number;
  seed: number;
}

/** A kept sandbox: the `v1.<data>` link (stored as text, decoded by the caller) and the player's notes. */
export interface SandboxSave {
  link: string;
  notes: { tick: number; text: string }[];
}

export interface Profile {
  /** The pages in the order they were kept. */
  pages(): Promise<BookPage[]>;
  keepMyth(page: MythPage, seed: number): Promise<BookPage>;
  /**
   * Adds the sixth verse (ADR 0013 item 13) to the page of `year`, once: a page with six verses is
   * left alone, and a year with no page changes nothing.
   */
  addVerse(year: number, verse: MythPage['verses'][number]): Promise<void>;
  feathers(): Promise<number>;
  /** Counts one more feather and returns the new count. */
  addFeather(): Promise<number>;
  /** The Kith the player carries on, or null. */
  kith(): Promise<Carry | null>;
  /** Keeps `carry`, replacing any earlier one. */
  setKith(carry: Carry): Promise<void>;
  /** The finished valleys, each once, in first-played order. */
  valleys(): Promise<string[]>;
  /** Keeps a sandbox valley id once; any other id changes nothing. */
  addValley(id: string): Promise<void>;
  sandbox(): Promise<SandboxSave | null>;
  /** Keeps the sandbox, cutting each note to NOTE_LENGTH characters. */
  keepSandbox(save: SandboxSave): Promise<void>;
  /**
   * Forgets the kept sandbox: one that no longer opens (an older build's) is not offered again.
   * It forgets only the save with this link, so a save that another tab kept since stays.
   */
  dropSandbox(link: string): Promise<void>;
}

const KEY = 'profile';
/** A page holds the five Part 1 verses, then the sixth. */
const SIXTH = 6;

/** Unknown ids and repeats drop out; the rest keep their order. */
const ValleysSchema = z
  .array(z.string())
  .transform((ids) =>
    [...new Set(ids)].filter((v): v is SandboxValley => (SANDBOX_VALLEYS as readonly string[]).includes(v)),
  );
/** A sandbox as stored or kept: a note over NOTE_LENGTH characters is cut, not refused. */
const SandboxSchema = z.object({
  link: z.string().max(MAX_LINK_TEXT).startsWith('v1.'),
  notes: z.array(
    z.object({
      tick: z.number().int().nonnegative(),
      text: z.string().transform(cutNote),
    }),
  ),
});

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
  // A profile from before these keys reads as the defaults, and a bad value in one of them falls
  // back to its default without losing the pages, the feathers, or the other new fields.
  kith: CarrySchema.nullable().catch(null),
  valleys: ValleysSchema.catch([]),
  sandbox: SandboxSchema.nullable().catch(null),
}) satisfies z.ZodType<{
  pages: BookPage[];
  feathers: number;
  kith: Carry | null;
  valleys: SandboxValley[];
  sandbox: SandboxSave | null;
}>;

type Data = z.infer<typeof ProfileSchema>;
const empty = (): Data => ({ pages: [], feathers: 0, kith: null, valleys: [], sandbox: null });
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
    async addVerse(year, verse) {
      await write((d) => {
        const page = d.pages.find((p) => p.year === year);
        if (page && page.verses.length < SIXTH) page.verses.push({ ...verse });
      });
    },
    feathers: async () => (await read()).feathers,
    async addFeather() {
      return (
        await write((d) => {
          d.feathers += 1;
        })
      ).feathers;
    },
    kith: async () => (await read()).kith,
    async setKith(carry) {
      const kept = CarrySchema.parse(carry); // a bad carry is a caller bug: throw, never store it
      await write((d) => {
        d.kith = kept;
      });
    },
    valleys: async () => (await read()).valleys,
    async addValley(id) {
      const valley = SANDBOX_VALLEYS.find((v) => v === id);
      if (!valley) return;
      await write((d) => {
        if (!d.valleys.includes(valley)) d.valleys.push(valley);
      });
    },
    sandbox: async () => (await read()).sandbox,
    async keepSandbox(save) {
      const kept = SandboxSchema.parse(save); // a bad link or tick is a caller bug: throw
      await write((d) => {
        d.sandbox = kept;
      });
    },
    async dropSandbox(link) {
      await write((d) => {
        if (d.sandbox?.link === link) d.sandbox = null;
      });
    },
  };
}
