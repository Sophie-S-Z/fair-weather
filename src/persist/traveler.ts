// Traveler codes (ADR 0015 item 9): `t1.<data>`, packed as a seed link is, with the same strictness.
import { TravelerSchema } from '../story/traveler.ts';
import type { Traveler } from '../story/traveler.ts';
import { canonical, pack, unpack } from './seed-link.ts';

/** The longest code decode reads: a traveler's JSON is well under 2 KiB. */
export const MAX_TRAVELER_TEXT = 4096;

/** `t1.<data>`; rejects when `t` fails TravelerSchema. */
export const encodeTraveler = async (t: Traveler): Promise<string> =>
  pack('t1.', JSON.stringify(TravelerSchema.parse(t)));

/**
 * The traveler in `text` (spaces at its ends are cut, as a paste brings them), or null when it does
 * not unpack (MAX_TRAVELER_TEXT, `t1.`), fails TravelerSchema, or is not the JSON encodeTraveler
 * writes for it. Never throws.
 */
export async function decodeTraveler(text: string): Promise<Traveler | null> {
  const json = await unpack(text.trim(), 't1.', MAX_TRAVELER_TEXT);
  return json === null ? null : canonical(json, TravelerSchema);
}
