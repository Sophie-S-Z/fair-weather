import { expect, test } from 'vitest';
import { buildPalette, encodeGif } from '../../../src/persist/gif.ts';
import type { RgbaFrame } from '../../../src/persist/gif.ts';

const frameOf = (
  width: number,
  height: number,
  rgb: (i: number) => [number, number, number],
  delayMs = 100,
): RgbaFrame => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const [r, g, b] = rgb(i);
    data.set([r, g, b, 255], i * 4);
  }
  return { width, height, data, delayMs };
};

interface Decoded {
  width: number;
  height: number;
  palette: Uint8Array;
  delays: number[];
  frames: Uint8Array[];
  netscape: number;
  comments: number;
  trailer: number;
  clears: number;
}

/** LZW decoding as the GIF spec has it: variable width, clear and end codes, a 4096-code table. */
const lzwDecode = (
  minSize: number,
  bytes: number[],
  count: number,
  tally: { clears: number },
): Uint8Array => {
  const clear = 1 << minSize;
  const end = clear + 1;
  const out = new Uint8Array(count);
  let n = 0;
  let table: number[][] = [];
  let width = minSize + 1;
  let prev: number[] | null = null;
  let acc = 0;
  let bits = 0;
  let at = 0;
  const reset = (): void => {
    table = [];
    for (let i = 0; i < clear; i += 1) table.push([i]);
    table.push([], []);
    width = minSize + 1;
    prev = null;
  };
  reset();
  for (;;) {
    while (bits < width && at < bytes.length) {
      acc |= (bytes[at++] as number) << bits;
      bits += 8;
    }
    if (bits < width) throw new Error('ran out of data before the end code');
    const code = acc & ((1 << width) - 1);
    acc >>>= width;
    bits -= width;
    if (code === clear) {
      tally.clears += 1;
      reset();
      continue;
    }
    if (code === end) break;
    let entry: number[];
    if (code < table.length) entry = table[code] as number[];
    else if (code === table.length && prev) entry = [...prev, prev[0] as number];
    else throw new Error(`bad code ${String(code)}`);
    for (const v of entry) out[n++] = v;
    if (prev && table.length < 4096) table.push([...prev, entry[0] as number]);
    prev = entry;
    if (table.length === 1 << width && width < 12) width += 1;
  }
  expect(n).toBe(count);
  return out;
};

const decode = (g: Uint8Array): Decoded => {
  const text = (a: number, b: number): string => String.fromCharCode(...g.slice(a, b));
  expect(text(0, 6)).toBe('GIF89a');
  const width = (g[6] as number) | ((g[7] as number) << 8);
  const height = (g[8] as number) | ((g[9] as number) << 8);
  expect(g[10]).toBe(0xf7);
  const palette = g.slice(13, 13 + 768);
  const d: Decoded = {
    width,
    height,
    palette,
    delays: [],
    frames: [],
    netscape: 0,
    comments: 0,
    trailer: 0,
    clears: 0,
  };
  let p = 13 + 768;
  const blocks = (): number[] => {
    const bytes: number[] = [];
    for (let len = g[p++] as number; len > 0; len = g[p++] as number) {
      for (let i = 0; i < len; i += 1) bytes.push(g[p++] as number);
    }
    return bytes;
  };
  for (;;) {
    const tag = g[p++];
    if (tag === 0x3b) {
      d.trailer = p;
      break;
    }
    if (tag === 0x21) {
      const label = g[p++];
      if (label === 0xf9) {
        expect(g[p]).toBe(4);
        d.delays.push((g[p + 2] as number) | ((g[p + 3] as number) << 8));
        p += 6;
        expect(g[p - 1]).toBe(0);
      } else if (label === 0xff) {
        expect(text(p + 1, p + 12)).toBe('NETSCAPE2.0');
        expect([...g.slice(p + 12, p + 17)]).toEqual([3, 1, 0, 0, 0]);
        d.netscape += 1;
        p += 17;
      } else {
        if (label === 0xfe) d.comments += 1;
        blocks();
      }
    } else if (tag === 0x2c) {
      const w = (g[p + 4] as number) | ((g[p + 5] as number) << 8);
      const h = (g[p + 6] as number) | ((g[p + 7] as number) << 8);
      expect([w, h]).toEqual([width, height]);
      p += 9;
      const min = g[p++] as number;
      expect(min).toBe(8);
      d.frames.push(lzwDecode(min, blocks(), w * h, d));
    } else throw new Error(`unexpected block 0x${(tag ?? -1).toString(16)} at ${String(p - 1)}`);
  }
  return d;
};

const expand = (v: number): number => (v << 3) | (v >> 2);

/** The palette index nearest a 15-bit color's expansion; ties to the lower index. */
const nearestIn = (pal: Uint8Array, r: number, g: number, b: number): number => {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < 256; k += 1) {
    const dist =
      ((pal[k * 3] as number) - r) ** 2 +
      ((pal[k * 3 + 1] as number) - g) ** 2 +
      ((pal[k * 3 + 2] as number) - b) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = k;
    }
  }
  return best;
};

test('the file starts GIF89a with the frame size and ends with 0x3b', () => {
  const g = encodeGif([frameOf(7, 5, () => [255, 0, 0])]);
  expect(String.fromCharCode(...g.slice(0, 6))).toBe('GIF89a');
  expect([g[6], g[7], g[8], g[9]]).toEqual([7, 0, 5, 0]);
  expect(g[g.length - 1]).toBe(0x3b);
  expect(() => encodeGif([])).toThrow();
  expect(() => encodeGif([frameOf(2, 2, () => [0, 0, 0]), frameOf(3, 2, () => [0, 0, 0])])).toThrow();
});

test('a 3-color frame decodes back to its exact pixels', () => {
  const colors: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [8, 16, 255],
  ];
  const f = frameOf(9, 7, (i) => colors[(i * 7 + (i >> 3)) % 3] as [number, number, number]);
  const d = decode(encodeGif([f]));
  expect(d.frames).toHaveLength(1);
  for (let i = 0; i < 63; i += 1) {
    const k = (d.frames[0] as Uint8Array)[i] as number;
    expect([...d.palette.slice(k * 3, k * 3 + 3)]).toEqual(
      [f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]].map((v) => expand((v as number) >> 3)),
    );
  }
});

test('buildPalette orders by popularity, ties to the lower 15-bit value, unused entries black', () => {
  const f = frameOf(
    6,
    1,
    (i) =>
      [
        [0, 0, 8],
        [0, 0, 8],
        [0, 0, 0],
        [0, 0, 16],
        [0, 0, 16],
        [0, 0, 24],
      ][i] as [number, number, number],
  );
  const p = buildPalette([f]);
  expect(p).toHaveLength(768);
  expect([...p.slice(0, 12)]).toEqual([0, 0, 8, 0, 0, 16, 0, 0, 0, 0, 0, 24]);
  expect(p.slice(12).every((v) => v === 0)).toBe(true);
});

test('a 480 by 318 frame of 300 colors maps each pixel to its nearest palette color', () => {
  const w = 480;
  const h = 318;
  const colorAt = (i: number): [number, number, number] => {
    const c = (i * 31 + (i >> 5)) % 300;
    return [(c * 37) % 256, (c * 91 + 13) % 256, (c * 53 + 101) % 256];
  };
  const f = frameOf(w, h, colorAt);
  const d = decode(encodeGif([f]));
  const pal = d.palette;
  expect([...pal]).toEqual([...buildPalette([f])]);
  const got = d.frames[0] as Uint8Array;
  const seen = new Set<number>();
  let mismatches = 0;
  for (let i = 0; i < w * h; i += 1) {
    const [r, g, b] = colorAt(i);
    const want = nearestIn(pal, expand(r >> 3), expand(g >> 3), expand(b >> 3));
    seen.add(want);
    if (got[i] !== want) mismatches += 1;
  }
  expect(mismatches).toBe(0);
  expect(seen.size).toBeGreaterThan(200);
});

test('a run of 5000 pixels of one color decodes', () => {
  const d = decode(encodeGif([frameOf(5000, 1, () => [0, 255, 0])]));
  expect(d.frames[0]?.every((v) => v === 0)).toBe(true);
});

test('frames of noise cross the 4096-code limit once and then twice or more, and decode to the nearest colors', () => {
  const noise = (side: number): RgbaFrame =>
    frameOf(side, side, (i) => [(i * 7919) % 256, ((i * 104729) >> 3) % 256, (i * 31) % 256]);
  for (const [side, atLeast] of [
    [200, 1],
    [400, 2],
  ] as const) {
    const f = noise(side);
    const d = decode(encodeGif([f]));
    expect(d.clears).toBeGreaterThanOrEqual(atLeast + 1);
    const got = d.frames[0] as Uint8Array;
    expect(got).toHaveLength(side * side);
    let mismatches = 0;
    for (let i = 0; i < got.length; i += 1) {
      const [r, g, b] = [f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]] as [number, number, number];
      if (got[i] !== nearestIn(d.palette, expand(r >> 3), expand(g >> 3), expand(b >> 3))) mismatches += 1;
    }
    expect(mismatches).toBe(0);
  }
});

test('it throws for a size below 1 or above 65535, or data that is not width by height by 4', () => {
  const ok = frameOf(2, 2, () => [0, 0, 0]);
  expect(() => encodeGif([{ ...ok, width: 0, height: 2, data: new Uint8ClampedArray(0) }])).toThrow();
  expect(() => encodeGif([{ ...ok, width: 65_536, height: 1 }])).toThrow();
  expect(() => encodeGif([{ ...ok, data: new Uint8ClampedArray(12) }])).toThrow();
});

test('delays: 83 ms gives 8, 5 ms gives 2', () => {
  const a = frameOf(2, 2, () => [0, 0, 0], 83);
  const b = frameOf(2, 2, () => [0, 0, 0], 5);
  expect(decode(encodeGif([a, b, { ...a, delayMs: 1000 }])).delays).toEqual([8, 2, 100]);
});

test('it writes one NETSCAPE2.0 block and no comment block', () => {
  const f = frameOf(3, 3, () => [255, 255, 255]);
  const d = decode(encodeGif([f, f, f]));
  expect(d.netscape).toBe(1);
  expect(d.comments).toBe(0);
  expect(d.frames).toHaveLength(3);
});

test('60 frames of 480 by 318 decode to 60 frames of that size', () => {
  const frames = Array.from({ length: 60 }, (_, n) =>
    frameOf(480, 318, (i) => {
      const x = i % 480;
      const y = (i / 480) | 0;
      return y > 270 ? [246, 241, 231] : [(x + n * 3) % 256, (y * 2 + (x >> 2)) % 256, ((x ^ y) + n) % 256];
    }),
  );
  const d = decode(encodeGif(frames));
  expect([d.width, d.height, d.frames.length]).toEqual([480, 318, 60]);
  expect(d.frames.every((f) => f.length === 480 * 318)).toBe(true);
});
