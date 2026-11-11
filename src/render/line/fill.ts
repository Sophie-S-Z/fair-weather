/** Where segment p1-p2 crosses segment p3-p4, as [x, y], or null. Touching ends do not count. */
export function crossing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): [number, number] | null {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [x1 + t * (x2 - x1), y1 + t * (y2 - y1)] : null;
}

/**
 * The outline of a line for a body fill: flat x, y pairs with every loop cut out. Where the line
 * crosses an earlier part of itself (a curl), the points between the two crossings are dropped and
 * the crossing point is kept, so the triangulator never gets a self-crossing polygon.
 */
export function fillOutline(points: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let k = 0; k + 1 < points.length; k += 2) {
    const x = points[k] ?? 0;
    const y = points[k + 1] ?? 0;
    const n = out.length;
    if (n >= 2) {
      const px = out[n - 2] ?? 0;
      const py = out[n - 1] ?? 0;
      // Check the new segment against every earlier segment except the one it touches.
      for (let j = 0; j + 3 < n - 2; j += 2) {
        const hit = crossing(px, py, x, y, out[j] ?? 0, out[j + 1] ?? 0, out[j + 2] ?? 0, out[j + 3] ?? 0);
        if (hit) {
          out.length = j + 2;
          out.push(hit[0], hit[1]);
          break;
        }
      }
    }
    out.push(x, y);
  }
  return out;
}
