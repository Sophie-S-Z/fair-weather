/** The toybox colors. Ink and paper come from the creature drawings; the rest are soft prop tints. */
export const PALETTE = {
  ink: 0x2b2a28,
  paper: 0xfffdf8,
  page: 0xe4edf0,
  floor: 0xf3ead6,
  accent: 0xf08a3c,
  blush: 0xf2a39b,
  cookie: 0xdcaa66,
  leaf: 0xa9cf8e,
  berry: 0xd9475b,
  water: 0xbcdbe9,
  glass: 0xdbeef6,
  wood: 0xd8b48a,
  glow: 0xffe7a3,
  bubble: 0xffffff,
} as const;

export type Palette = typeof PALETTE;
