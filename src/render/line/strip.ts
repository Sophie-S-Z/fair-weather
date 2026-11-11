const TAPER_POINTS = 6;
const TAPER_END = 0.3;

/**
 * Builds a triangle strip around a polyline: 2 vertices per point, offset either side along the
 * miter direction (the bisector of the adjacent segment normals) so each pair is `width(i)` apart.
 * Returns the vertex count.
 */
export function buildStrip(points: Float32Array, width: (i: number) => number, out: Float32Array): number {
  const n = points.length >> 1;
  for (let i = 0; i < n; i++) {
    const x = points[2 * i] ?? 0;
    const y = points[2 * i + 1] ?? 0;
    let mx = 0;
    let my = 0;
    if (i > 0) {
      const dx = x - (points[2 * i - 2] ?? 0);
      const dy = y - (points[2 * i - 1] ?? 0);
      const len = Math.hypot(dx, dy) || 1;
      mx -= dy / len;
      my += dx / len;
    }
    if (i < n - 1) {
      const dx = (points[2 * i + 2] ?? 0) - x;
      const dy = (points[2 * i + 3] ?? 0) - y;
      const len = Math.hypot(dx, dy) || 1;
      mx -= dy / len;
      my += dx / len;
    }
    const mlen = Math.hypot(mx, my);
    if (mlen > 1e-9) {
      mx /= mlen;
      my /= mlen;
    } else {
      mx = 0;
      my = 1;
    }
    const h = width(i) / 2;
    out[4 * i] = x + mx * h;
    out[4 * i + 1] = y + my * h;
    out[4 * i + 2] = x - mx * h;
    out[4 * i + 3] = y - my * h;
  }
  return n * 2;
}

/** A width function that holds `base` and tapers to 30% over the first and last 6 points (round ends). */
export function taperedWidth(base: number, count: number): (i: number) => number {
  return (i) => {
    const k = Math.min(i, count - 1 - i);
    if (k >= TAPER_POINTS) return base;
    return base * (TAPER_END + (1 - TAPER_END) * Math.sin(((Math.PI / 2) * k) / TAPER_POINTS));
  };
}

/** Triangle indices for a strip of `vertexCount` vertices (2 per point). */
export function stripIndices(vertexCount: number): Uint32Array {
  const quads = (vertexCount >> 1) - 1;
  const idx = new Uint32Array(quads * 6);
  for (let q = 0; q < quads; q++) {
    const a = 2 * q;
    idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], q * 6);
  }
  return idx;
}
