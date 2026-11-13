// The valley's own line under the status line (plan task M3.13): what the Fen's water shows Tove,
// or what the Hollow's gazette printed. Text with meaning is HTML (spec 17).
import type { WorldLite } from '../sim-host/protocol.ts';

/** `text` is shown; `spoken` is what the live region says, which in the Fen moves only in steps of 10%. */
export type ValleyLineText = { text: string; spoken: string };

const percent = (share: number): number => Math.round(share * 100);
const step = (share: number): number => Math.round(share * 10) * 10;

/**
 * Fen: Tove's perceived share (the reflection, ADR 0007) and the share of the flock really in
 * flight. Both count the hero: the reflection weighs it as one of Tove's neighbors, so the flock's
 * share counts the starlings not away and the hero (flying while it has joined). Hollow: the last
 * print's subject, the hero by its own name, once there is one. Null in any other world.
 */
export function valleyLine(lite: WorldLite | null, label: (id: string) => string): ValleyLineText | null {
  const pack = lite?.pack;
  if (!lite || !pack) return null;
  if (pack.id === 'fen') {
    const flying = new Set(pack.flying);
    const flock = lite.creatures.filter(
      (c) => (c.speciesId === 'starling' || c.id === 'hero') && c.state !== 'away',
    );
    const real = flock.length === 0 ? 0 : flock.filter((c) => flying.has(c.id)).length / flock.length;
    const seen = pack.perceived['tove'] ?? 0;
    const line = (p: number, r: number, about: string): string =>
      `Tove sees ${about}${String(p)}% of its neighbors flying in the water; ${about}${String(r)}% of the starlings really fly.`;
    return { text: line(percent(seen), percent(real), ''), spoken: line(step(seen), step(real), 'about ') };
  }
  if (pack.id === 'hollow') {
    if (pack.front === null) return { text: '', spoken: '' };
    const front = pack.front === 'hero' && lite.hero ? lite.hero.name : label(pack.front);
    const text = `The gazette: ${front} is on the front page.`;
    return { text, spoken: text };
  }
  return null;
}
