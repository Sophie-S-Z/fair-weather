import { z } from 'zod';
import stickersJson from '../../content/toy/stickers.json';
import { CAST_IDS, PROP_KINDS, STICKER_IDS, type StickerId } from '../toy/types.ts';

const ThemeId = z.enum(['game', 'mind', 'big', 'ties']);

const StickerSchema = z.strictObject({
  id: z.enum(STICKER_IDS),
  theme: ThemeId,
  title: z.string().min(1),
  riddle: z.string().min(1),
  art: z.strictObject({ cast: z.enum(CAST_IDS), prop: z.enum(PROP_KINDS).nullable() }),
  lesson: z.array(z.string().min(1)).min(2).max(4),
  knob: z.string().min(1).optional(),
  tryThis: z.string().min(1),
});

const BookSchema = z.strictObject({
  themes: z.array(z.strictObject({ id: ThemeId, title: z.string().min(1) })).length(4),
  stickers: z.array(StickerSchema).length(STICKER_IDS.length),
});

export type Sticker = z.infer<typeof StickerSchema>;

export const BOOK = BookSchema.parse(stickersJson);

export const stickerById = (id: StickerId): Sticker => {
  const s = BOOK.stickers.find((k) => k.id === id);
  if (!s) throw new Error(`No sticker ${id}`);
  return s;
};
