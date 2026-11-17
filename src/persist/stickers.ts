const KEY = 'fair-weather.stickers';

/** Where found stickers live: `localStorage`, or nothing when the browser blocks it. */
export interface StickerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The found sticker ids that are still known ids. Bad or blocked storage reads as none. */
export function loadFound<T extends string>(storage: StickerStorage | null, known: readonly T[]): T[] {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? known.filter((id) => raw.includes(id)) : [];
  } catch {
    return [];
  }
}

export function saveFound(storage: StickerStorage | null, found: readonly string[]): void {
  try {
    if (found.length === 0) storage?.removeItem(KEY);
    else storage?.setItem(KEY, JSON.stringify(found));
  } catch {
    // Blocked storage: stickers last for this visit only.
  }
}
