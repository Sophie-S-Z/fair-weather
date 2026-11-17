/** How a creature's line bends, each value 0..1: hunched, spiky, tinted, and smooth. */
export interface Shell {
  tightness: number;
  bristle: number;
  color: number;
  softness: number;
}
