// A small animated GIF encoder: one global 256-color palette, LZW, and an endless loop.

/** RGB at 5 bits per channel: the key for palette buckets and the nearest-color cache. */
const key = (r: number, g: number, b: number): number => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

export interface Palette {
  /** 256 RGB triples. */
  colors: Uint8Array;
  /** The palette index nearest to an RGB color. */
  index(r: number, g: number, b: number): number;
}

/**
 * A palette from sample frames (RGBA pixels): the 256 most common color buckets, each as its mean.
 * Ink drawings use few colors, so the popular buckets cover them, and the soft edges map to the nearest.
 */
export function buildPalette(samples: readonly Uint8ClampedArray[]): Palette {
  const sum = new Float64Array(32768 * 4);
  for (const px of samples) {
    for (let i = 0; i < px.length; i += 4) {
      const k = key(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0) * 4;
      sum[k] = (sum[k] ?? 0) + (px[i] ?? 0);
      sum[k + 1] = (sum[k + 1] ?? 0) + (px[i + 1] ?? 0);
      sum[k + 2] = (sum[k + 2] ?? 0) + (px[i + 2] ?? 0);
      sum[k + 3] = (sum[k + 3] ?? 0) + 1;
    }
  }
  const used = [...Array(32768).keys()].filter((k) => (sum[k * 4 + 3] ?? 0) > 0);
  used.sort((a, b) => (sum[b * 4 + 3] ?? 0) - (sum[a * 4 + 3] ?? 0));
  const colors = new Uint8Array(256 * 3);
  const count = Math.min(256, used.length);
  used.slice(0, count).forEach((k, i) => {
    const n = sum[k * 4 + 3] ?? 1;
    for (let c = 0; c < 3; c++) colors[i * 3 + c] = Math.round((sum[k * 4 + c] ?? 0) / n);
  });

  const cache = new Int16Array(32768).fill(-1);
  return {
    colors,
    index(r, g, b) {
      const k = key(r, g, b);
      const hit = cache[k] ?? -1;
      if (hit >= 0) return hit;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < count; i++) {
        const d =
          ((colors[i * 3] ?? 0) - r) ** 2 +
          ((colors[i * 3 + 1] ?? 0) - g) ** 2 +
          ((colors[i * 3 + 2] ?? 0) - b) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      cache[k] = best;
      return best;
    },
  };
}

/** The palette index of each pixel of an RGBA frame. */
export function indexFrame(px: Uint8ClampedArray, palette: Palette): Uint8Array {
  const out = new Uint8Array(px.length / 4);
  for (let i = 0; i < out.length; i++)
    out[i] = palette.index(px[i * 4] ?? 0, px[i * 4 + 1] ?? 0, px[i * 4 + 2] ?? 0);
  return out;
}

/** GIF LZW with an 8-bit minimum code size, packed into 255-byte sub-blocks. */
function lzw(indices: Uint8Array, out: number[]): void {
  const CLEAR = 256;
  const END = 257;
  let size = 9;
  let next = 258;
  let dict = new Map<number, number>();
  let bits = 0;
  let nbits = 0;
  const bytes: number[] = [];
  const emit = (code: number): void => {
    bits |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      bytes.push(bits & 0xff);
      bits >>>= 8;
      nbits -= 8;
    }
  };

  emit(CLEAR);
  let prefix = indices[0] ?? 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i] ?? 0;
    const pair = (prefix << 8) | k;
    const found = dict.get(pair);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(pair, next++);
      // The decoder widens one code later than the encoder adds, so widen when next passes 2^size.
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(CLEAR);
      dict = new Map();
      next = 258;
      size = 9;
    }
    prefix = k;
  }
  emit(prefix);
  emit(END);
  if (nbits > 0) bytes.push(bits & 0xff);

  out.push(8);
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255);
    out.push(block.length, ...block);
  }
  out.push(0);
}

/** An endless-loop GIF writer: add indexed frames, then take the bytes. */
export function createGif(width: number, height: number, palette: Palette, delayCs: number) {
  const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const head: number[] = [...ascii('GIF89a')];
  const u16 = (n: number): number[] => [n & 0xff, n >> 8];
  head.push(...u16(width), ...u16(height), 0xf7, 0, 0, ...palette.colors);
  // NETSCAPE2.0 extension: loop forever.
  head.push(0x21, 0xff, 11, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  parts.push(Uint8Array.from(head));

  return {
    add(indices: Uint8Array): void {
      const frame: number[] = [0x21, 0xf9, 4, 0, ...u16(delayCs), 0, 0];
      frame.push(0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0);
      lzw(indices, frame);
      parts.push(Uint8Array.from(frame));
    },
    finish(): Uint8Array<ArrayBuffer>[] {
      return [...parts, Uint8Array.of(0x3b)];
    },
  };
}
