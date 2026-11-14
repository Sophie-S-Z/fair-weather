// The postcard's GIF encoder (ADR 0014 items 8 and 19): GIF89a, one global 256-color palette, LZW
// with minimum code size 8, a NETSCAPE2.0 loop that runs forever, and no comment block.
export interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  delayMs: number;
}

/** A pixel's 15-bit color: its top five bits of red, green, and blue. */
const key15 = (d: Uint8ClampedArray, o: number): number =>
  (((d[o] as number) >> 3) << 10) | (((d[o + 1] as number) >> 3) << 5) | ((d[o + 2] as number) >> 3);
/** A 5-bit channel back to 8 bits by repeating its top bits, so 31 gives 255. */
const expand = (v: number): number => (v << 3) | (v >> 2);

/**
 * The 768-byte palette (red, green, blue per entry): the 256 most used 15-bit colors over every
 * frame, each expanded to 8 bits per channel. Ties go to the lower 15-bit value; unused entries are
 * black. Alpha is ignored: the canvas is opaque.
 */
export const buildPalette = (frames: readonly RgbaFrame[]): Uint8Array => {
  const counts = new Uint32Array(32_768);
  for (const f of frames) {
    for (let o = 0; o < f.data.length; o += 4) {
      const k = key15(f.data, o);
      counts[k] = (counts[k] as number) + 1;
    }
  }
  const used: number[] = [];
  for (let k = 0; k < 32_768; k += 1) if (counts[k]) used.push(k);
  used.sort((a, b) => (counts[b] as number) - (counts[a] as number) || a - b);
  const palette = new Uint8Array(768);
  used.slice(0, 256).forEach((k, i) => {
    palette.set([expand(k >> 10), expand((k >> 5) & 31), expand(k & 31)], i * 3);
  });
  return palette;
};

/** LZW over palette indexes, as GIF sub-blocks (255 bytes at most each) ending in a zero block. */
const lzw = (px: Uint8Array, out: number[]): void => {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  let width = 9;
  let next = 258;
  const keys = new Int32Array(8192);
  const codes = new Uint16Array(8192);
  const put = (code: number): void => {
    acc |= code << bits;
    bits += width;
    for (; bits >= 8; bits -= 8, acc >>>= 8) bytes.push(acc & 255);
  };
  /** The table slot for a (prefix code, pixel) pair: its own, or the empty one where it would go. */
  const slot = (key: number): number => {
    let s = Math.imul(key, 2_654_435_761) >>> 19;
    while (keys[s] !== -1 && keys[s] !== key) s = (s + 1) & 8191;
    return s;
  };
  /** Adds the entry that the decoder adds after this code; at 4095 entries, clears instead. */
  const grow = (): void => {
    const added = next++;
    if (added === 4095) {
      put(256);
      keys.fill(-1);
      width = 9;
      next = 258;
    } else if (added === 1 << width) width += 1;
  };
  keys.fill(-1);
  put(256);
  let prefix = px[0] as number;
  for (let i = 1; i < px.length; i += 1) {
    const p = px[i] as number;
    const key = (prefix << 8) | p;
    const s = slot(key);
    if (keys[s] === key) prefix = codes[s] as number;
    else {
      put(prefix);
      keys[s] = key;
      codes[s] = next;
      grow();
      prefix = p;
    }
  }
  put(prefix);
  grow();
  put(257);
  if (bits > 0) bytes.push(acc & 255);
  for (let i = 0; i < bytes.length; i += 255)
    out.push(Math.min(255, bytes.length - i), ...bytes.slice(i, i + 255));
  out.push(0);
};

/** A 16-bit value as two little-endian bytes. */
const le16 = (v: number): number[] => [v & 255, (v >> 8) & 255];

/**
 * Encodes the frames as one looping GIF. By design, each pixel takes the palette color nearest its
 * 15-bit color, not its raw 8-bit color: nearest is by squared distance on the 8-bit expansion of
 * the 15-bit color (ties to the lower index), found once per 15-bit color through a table filled
 * on first use. Throws for no frames, frames of different sizes, a width or height outside 1 to
 * 65535, or `data` that is not width x height x 4 bytes.
 */
export const encodeGif = (frames: readonly RgbaFrame[]): Uint8Array => {
  const first = frames[0];
  if (!first) throw new Error('A GIF needs at least one frame.');
  const { width, height } = first;
  if (frames.some((f) => f.width !== width || f.height !== height))
    throw new Error('All frames must be the same size.');
  if (width < 1 || height < 1 || width > 65_535 || height > 65_535)
    throw new Error('A GIF is 1 to 65535 pixels each way.');
  if (frames.some((f) => f.data.length !== width * height * 4))
    throw new Error('Frame data must be width x height x 4 bytes.');
  const palette = buildPalette(frames);
  const text = (t: string): number[] => Array.from(t, (c) => c.charCodeAt(0));
  const out: number[] = [...text('GIF89a'), ...le16(width), ...le16(height), 0xf7, 0, 0, ...palette];
  out.push(0x21, 0xff, 11, ...text('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  const lut = new Int16Array(32_768).fill(-1);
  const nearest = (k: number): number => {
    const r = expand(k >> 10);
    const g = expand((k >> 5) & 31);
    const b = expand(k & 31);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 256; i += 1) {
      const d =
        ((palette[i * 3] as number) - r) ** 2 +
        ((palette[i * 3 + 1] as number) - g) ** 2 +
        ((palette[i * 3 + 2] as number) - b) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    }
    return best;
  };
  for (const f of frames) {
    const delay = Math.max(2, Math.round(f.delayMs / 10));
    out.push(0x21, 0xf9, 4, 0, ...le16(delay), 0, 0, 0x2c, 0, 0, 0, 0, ...le16(width), ...le16(height), 0, 8);
    const px = new Uint8Array(width * height);
    for (let i = 0; i < px.length; i += 1) {
      const k = key15(f.data, i * 4);
      px[i] = lut[k] === -1 ? (lut[k] = nearest(k)) : (lut[k] as number);
    }
    lzw(px, out);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
};
