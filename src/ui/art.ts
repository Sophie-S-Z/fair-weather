import type { CastId, PropKind } from '../toy/types.ts';

export type Tool = 'hand' | 'yarn' | 'scissors';

const svg = (body: string): string =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="#2b2a28" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Drawer and sticker pictures of each prop, in the table's ink style. */
export const PROP_ART: Record<PropKind, string> = {
  cookie: svg(
    '<circle cx="24" cy="25" r="15" fill="#dcaa66"/><circle cx="18" cy="20" r="2" fill="#2b2a28"/><circle cx="29" cy="23" r="2" fill="#2b2a28"/><circle cx="22" cy="31" r="2" fill="#2b2a28"/>',
  ),
  bush: svg(
    '<path d="M8 38 C3 30 6 18 16 15 C20 7 32 7 35 15 C44 17 46 30 40 38 Z" fill="#a9cf8e"/><circle cx="17" cy="25" r="3.2" fill="#d9475b"/><circle cx="28" cy="19" r="3.2" fill="#d9475b"/><circle cx="33" cy="30" r="3.2" fill="#d9475b"/>',
  ),
  mirror: svg('<ellipse cx="24" cy="18" rx="11" ry="14" fill="#dbeef6"/><path d="M24 32 V42 M17 42 H31"/>'),
  signpost: svg('<path d="M14 44 V8"/><path d="M10 10 H34 L40 16 L34 22 H10 Z" fill="#d8b48a"/>'),
  puddle: svg(
    '<ellipse cx="24" cy="30" rx="19" ry="7" fill="#bcdbe9"/><path d="M14 28 Q18 26 22 28" stroke="#fffdf8"/>',
  ),
  twins: svg(
    '<rect x="4" y="20" width="16" height="18" rx="2" fill="#d8b48a"/><rect x="28" y="20" width="16" height="18" rx="2" fill="#d8b48a"/><path d="M21 14 Q24 9 27 14 M25 11 L27 14 L24 15"/>',
  ),
  track: svg(
    '<path d="M4 26 H20 L44 14 M20 26 L44 38"/><path d="M20 26 V36" stroke="#2b2a28"/><circle cx="20" cy="38" r="3" fill="#d9475b"/>',
  ),
  lamp: svg(
    '<rect x="8" y="6" width="32" height="14" fill="#ffe7a3"/><rect x="12" y="32" width="28" height="10" fill="#e3cfb1"/><path d="M6 42 V30 M2 30 H10 L8 25 H4 Z" fill="#ffe7a3"/>',
  ),
};

export const TOOL_ART: Record<Tool, string> = {
  hand: svg(
    '<path d="M16 26 V12 a3 3 0 0 1 6 0 V22 V9 a3 3 0 0 1 6 0 V22 V12 a3 3 0 0 1 6 0 V28 C34 38 29 43 23 43 C17 43 13 39 10 33 L7 27 a3 3 0 0 1 5 -3 Z" fill="#fffdf8"/>',
  ),
  yarn: svg(
    '<circle cx="20" cy="24" r="13" fill="#f2a39b"/><path d="M9 18 Q20 22 30 13 M8 26 Q21 30 32 20 M11 33 Q22 35 32 28"/><path d="M33 26 Q42 30 40 42"/>',
  ),
  scissors: svg(
    '<circle cx="13" cy="35" r="6" fill="#fffdf8"/><circle cx="31" cy="37" r="6" fill="#fffdf8"/><path d="M16 30 L36 8 M27 32 L14 9"/>',
  ),
};

const creatureFiles = import.meta.glob<string>('../../content/creatures/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** The creature drawings as SVG markup, by cast id. */
export function creatureArt(id: CastId): string {
  return (creatureFiles[`../../content/creatures/${id}.svg`] ?? '').replace(
    '<svg ',
    '<svg aria-hidden="true" focusable="false" ',
  );
}
