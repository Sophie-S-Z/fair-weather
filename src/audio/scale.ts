import type { Season } from '../sim/types.ts';
import { AudioSchema } from './schema.ts';
import audioJson from '../../content/audio.json';

const audio = AudioSchema.parse(audioJson);

/** The season's scale tones in Hz, lowest first. */
export function scaleTones(season: Season): number[] {
  const root = audio.seasons[season].root;
  const out: number[] = [];
  for (let o = 0; o < audio.octaves; o += 1) {
    for (const s of audio.steps) out.push(root * Math.pow(2, (o * 12 + s) / 12));
  }
  return out;
}

/** A scale tone for a line length: longer lines are lower, equal or lower, clamped to the scale's range. */
export function pitchFor(lineLength: number, season: Season): number {
  const tones = scaleTones(season);
  const [lo, hi] = audio.lineRange;
  const t = Math.min(1, Math.max(0, (lineLength - lo) / (hi - lo)));
  return tones[Math.round((1 - t) * (tones.length - 1))] as number;
}
