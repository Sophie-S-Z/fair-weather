// Uniform spatial grid rebuilt each tick with a counting sort (no allocation per rebuild).
export interface Grid {
  rebuild(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): void;
  /** Clears `out`, then pushes indices within distance `r` of (x, y), ascending. */
  query(x: number, y: number, r: number, out: number[]): number[];
}

export function createGrid(width: number, height: number, cellSize: number): Grid {
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const cellStart = new Int32Array(cols * rows + 1);
  let cellItems = new Int32Array(0);
  let cellOf = new Int32Array(0);
  let px: ArrayLike<number> = [];
  let py: ArrayLike<number> = [];

  const col = (x: number): number => Math.min(cols - 1, Math.max(0, Math.floor(x / cellSize)));
  const row = (y: number): number => Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)));

  return {
    rebuild(xs, ys, count) {
      if (cellItems.length < count) {
        cellItems = new Int32Array(count);
        cellOf = new Int32Array(count);
      }
      px = xs;
      py = ys;
      cellStart.fill(0);
      for (let i = 0; i < count; i++) {
        const c = row(ys[i] as number) * cols + col(xs[i] as number);
        cellOf[i] = c;
        cellStart[c + 1] = (cellStart[c + 1] as number) + 1;
      }
      for (let c = 0; c < cols * rows; c++) {
        cellStart[c + 1] = (cellStart[c + 1] as number) + (cellStart[c] as number);
      }
      // Fill in index order so each cell holds ascending indices; cellStart[c] advances, then is restored.
      for (let i = 0; i < count; i++) {
        const c = cellOf[i] as number;
        cellItems[cellStart[c] as number] = i;
        cellStart[c] = (cellStart[c] as number) + 1;
      }
      for (let c = cols * rows; c > 0; c--) cellStart[c] = cellStart[c - 1] as number;
      cellStart[0] = 0;
    },
    query(x, y, r, out) {
      out.length = 0;
      const r2 = r * r;
      const c0 = col(x - r);
      const c1 = col(x + r);
      const r0 = row(y - r);
      const r1 = row(y + r);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const c = cy * cols + cx;
          const end = cellStart[c + 1] as number;
          for (let k = cellStart[c] as number; k < end; k++) {
            const i = cellItems[k] as number;
            const dx = (px[i] as number) - x;
            const dy = (py[i] as number) - y;
            if (dx * dx + dy * dy <= r2) out.push(i);
          }
        }
      }
      out.sort((a, b) => a - b);
      return out;
    },
  };
}
