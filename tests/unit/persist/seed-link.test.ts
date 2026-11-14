import { afterEach, expect, test, vi } from 'vitest';
import {
  LINK_CHARS,
  MAX_LINK_BYTES,
  MAX_LINK_LISTS,
  MAX_LINK_TICKS,
  SeedLinkSchema,
  VALLEY_FILE,
  decodeLink,
  encodeLink,
  fitsInLink,
} from '../../../src/persist/seed-link.ts';
import type { SeedLink } from '../../../src/persist/seed-link.ts';
import { DEFAULT_SWITCHES } from '../../../src/story/sandbox.ts';

const HASH = '0badf00d';

const link = (over: Partial<SeedLink> = {}): SeedLink => ({
  v: 1,
  tuning: HASH,
  setup: {
    seed: 7,
    valley: 'kith',
    kith: null,
    challenge: null,
    knobs: { giftValue: 4, fogLevel: 2 },
    switches: { ...DEFAULT_SWITCHES },
    structures: [{ id: 'bench-1', kind: 'bench', x: 100, y: 200 }],
    bushes: [{ id: 'bush-1', x: 300, y: 400 }],
  },
  script: [
    { tick: 0, list: [{ t: 'shine', x: 10, y: 20 }] },
    { tick: 5, list: [{ t: 'thread', a: 'pim', b: 'krit', on: true }] },
    { tick: 5, list: [{ t: 'whisper', target: 'pim', about: 'krit', sign: 1 }] },
    { tick: 9, list: [{ t: 'dance', who: 'pim' }] },
  ],
  tick: 40,
  ...over,
});

/** The `v1.<data>` text of any JSON text, as encodeLink would make it but with no schema check. */
async function rawLink(json: string): Promise<string> {
  const deflated = new Blob([new TextEncoder().encode(json)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(deflated).arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `v1.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a link round-trips through encode and decode', async () => {
  const text = await encodeLink(link());
  expect(await decodeLink(text, HASH)).toEqual(link());
  expect(VALLEY_FILE).toBe('fair-weather-valley.fairweather');
});

test('the data is URL-safe base64 with no padding', async () => {
  // Enough varied commands that the deflate output holds bytes that standard base64 writes as + and /.
  const script = Array.from({ length: 200 }, (_, i) => ({
    tick: i,
    list: [{ t: 'blow' as const, x: (i * 37) % 1600, y: (i * 91) % 900, dx: i % 7, dy: (i % 5) - 2 }],
  }));
  for (const l of [link(), link({ script, tick: 400 }), link({ script: [], tick: 0 })]) {
    const text = await encodeLink(l);
    expect(text).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect((text.length - 3) % 4).not.toBe(1);
    expect(await decodeLink(text, HASH)).toEqual(l);
  }
});

test('decode gives null for v2, a cut link, one extra character, bad base64, and another tuning hash', async () => {
  const text = await encodeLink(link());
  const data = text.slice(3);
  expect(await decodeLink(`v2.${data}`, HASH)).toBeNull();
  expect(await decodeLink(data, HASH)).toBeNull();
  expect(await decodeLink('', HASH)).toBeNull();
  expect(await decodeLink('v1.', HASH)).toBeNull();
  // Cut: the deflate stream ends early.
  expect(await decodeLink(text.slice(0, text.length - 4), HASH)).toBeNull();
  expect(await decodeLink(text.slice(0, 20), HASH)).toBeNull();
  // One extra character on data whose length is a multiple of 4 is a length base64 cannot have.
  const whole = data.slice(0, data.length - (data.length % 4));
  expect(await decodeLink(`v1.${whole}A`, HASH)).toBeNull();
  // Bad base64: standard alphabet, padding, a space, a line end, a character outside the alphabet.
  for (const bad of ['ab+c', 'ab/c', 'abc=', 'ab c', 'abc\n', 'ab.c', 'abcé']) {
    expect(await decodeLink(`v1.${bad}`, HASH)).toBeNull();
  }
  // Valid base64 that is not deflate.
  expect(await decodeLink('v1.____', HASH)).toBeNull();
  // Deflate that is not JSON.
  expect(await decodeLink(await rawLink('{"v":1,'), HASH)).toBeNull();
  expect(await decodeLink(text, 'deadbeef')).toBeNull();
});

test('decode stops at 1 MiB of inflated data and gives null', async () => {
  // Exactly MAX_LINK_BYTES of JSON (the link padded with spaces) decodes; one byte more does not.
  const json = JSON.stringify(link());
  const pad = (n: number) => json + ' '.repeat(n - json.length);
  expect(await decodeLink(await rawLink(pad(MAX_LINK_BYTES)), HASH)).toEqual(link());
  expect(await decodeLink(await rawLink(pad(MAX_LINK_BYTES + 1)), HASH)).toBeNull();

  // A 16 MiB bomb: count what the inflater gives, to see that decode stops reading at the cap.
  const bomb = await rawLink(' '.repeat(16 * MAX_LINK_BYTES));
  const Real = globalThis.DecompressionStream;
  let inflated = 0;
  vi.stubGlobal('DecompressionStream', function (format: CompressionFormat) {
    const real = new Real(format);
    const count = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, c) {
        inflated += chunk.byteLength;
        c.enqueue(chunk);
      },
    });
    return { writable: real.writable, readable: real.readable.pipeThrough(count) };
  });
  expect(await decodeLink(bomb, HASH)).toBeNull();
  expect(inflated).toBeGreaterThan(MAX_LINK_BYTES);
  expect(inflated).toBeLessThan(MAX_LINK_BYTES + 256 * 1024);
});

test('decode gives null for a script tick at or after the link tick, NaN, or 40,001 ticks', async () => {
  const json = (over: Record<string, unknown>) => rawLink(JSON.stringify({ ...link(), ...over }));
  const list = [{ t: 'shine', x: 1, y: 1 }];
  expect(await decodeLink(await json({}), HASH)).toEqual(link());
  expect(await decodeLink(await json({ script: [{ tick: 40, list }] }), HASH)).toBeNull();
  expect(await decodeLink(await json({ script: [{ tick: 41, list }] }), HASH)).toBeNull();
  expect(await decodeLink(await json({ script: [{ tick: 39, list }] }), HASH)).not.toBeNull();
  // Ticks may repeat but never go back; each is a whole number from 0.
  const back = [
    { tick: 6, list },
    { tick: 5, list },
  ];
  expect(await decodeLink(await json({ script: back }), HASH)).toBeNull();
  expect(await decodeLink(await json({ script: [{ tick: -1, list }] }), HASH)).toBeNull();
  expect(await decodeLink(await json({ script: [{ tick: 1.5, list }] }), HASH)).toBeNull();
  // JSON writes NaN as null; and as text it is not JSON at all.
  expect(await decodeLink(await json({ tick: Number.NaN }), HASH)).toBeNull();
  expect(
    await decodeLink(await rawLink(JSON.stringify(link()).replace('"tick":40}', '"tick":NaN}')), HASH),
  ).toBeNull();
  expect(await decodeLink(await json({ script: [], tick: MAX_LINK_TICKS }), HASH)).not.toBeNull();
  expect(await decodeLink(await json({ script: [], tick: MAX_LINK_TICKS + 1 }), HASH)).toBeNull();
  await expect(encodeLink(link({ tick: Number.NaN }))).rejects.toThrow();
  await expect(encodeLink(link({ script: [], tick: MAX_LINK_TICKS + 1 }))).rejects.toThrow();
  // At most MAX_LINK_LISTS lists.
  const lists = (n: number) => Array.from({ length: n }, () => ({ tick: 0, list: [] }));
  expect(SeedLinkSchema.safeParse(link({ script: lists(MAX_LINK_LISTS) })).success).toBe(true);
  expect(SeedLinkSchema.safeParse(link({ script: lists(MAX_LINK_LISTS + 1) })).success).toBe(false);
});

test('encode throws for an extra field (a name, a caption, a note) and for an id with a space or over 40 characters', async () => {
  const base = link();
  const extra: unknown[] = [
    { ...base, name: 'Ada' },
    { ...base, setup: { ...base.setup, caption: 'our valley' } },
    { ...base, setup: { ...base.setup, switches: { ...base.setup.switches, note: 'hi' } } },
    { ...base, setup: { ...base.setup, knobs: { note: 1 } } },
    {
      ...base,
      setup: { ...base.setup, structures: [{ id: 'bench-1', kind: 'bench', x: 1, y: 1, note: 'hi' }] },
    },
    { ...base, setup: { ...base.setup, bushes: [{ id: 'bush-1', x: 1, y: 1, name: 'Ada' }] } },
    { ...base, script: [{ tick: 0, list: [], note: 'hi' }] },
    { ...base, script: [{ tick: 0, list: [{ t: 'shine', x: 1, y: 1, caption: 'look' }] }] },
    {
      ...base,
      script: [{ tick: 0, list: [{ t: 'local', verb: { verb: 'join', on: true, note: 'hi' } }] }],
    },
  ];
  for (const l of extra) await expect(encodeLink(l as SeedLink)).rejects.toThrow();

  const badIds = ['two words', 'x'.repeat(41), 'Ada', '', 'ada!'];
  for (const id of badIds) {
    const setups = [
      { ...base.setup, structures: [{ id, kind: 'bench' as const, x: 1, y: 1 }] },
      { ...base.setup, bushes: [{ id, x: 1, y: 1 }] },
    ];
    for (const setup of setups) await expect(encodeLink({ ...base, setup })).rejects.toThrow();
    // Every free string a command has: a creature, a target, a keepsake.
    const commands: SeedLink['script'][number]['list'] = [
      { t: 'dance', who: id },
      { t: 'thread', a: 'pim', b: id, on: true },
      { t: 'whisper', target: id, about: 'krit', sign: -1 },
      { t: 'whisper', target: 'pim', about: id, sign: -1 },
      { t: 'walk', to: id },
      { t: 'local', verb: { verb: 'keepsake', to: 'pim', item: id } },
    ];
    for (const c of commands)
      await expect(encodeLink({ ...base, script: [{ tick: 0, list: [c] }] })).rejects.toThrow();
  }
  // An id at 40 characters is fine.
  const long = 'x'.repeat(40);
  await expect(
    encodeLink({ ...base, script: [{ tick: 0, list: [{ t: 'dance', who: long }] }] }),
  ).resolves.toMatch(/^v1\./);
  await expect(encodeLink({ ...base, tuning: 'ABCDEF12' })).rejects.toThrow();
  // The decoder refuses the same as the encoder: an extra field written past the schema.
  expect(await decodeLink(await rawLink(JSON.stringify({ ...base, name: 'Ada' })), HASH)).toBeNull();
});

test('a challenge link refuses more bridges than its limit, the setup and the script together', async () => {
  const bridge = (i: number) => ({ id: `bridge-${String(i)}`, kind: 'bridge' as const, x: 810, y: 300 });
  const place = { t: 'place' as const, kind: 'bridge' as const, x: 810, y: 600 };
  const bell = (structures: number, placed: number): SeedLink => {
    const base = link();
    return {
      ...base,
      setup: {
        ...base.setup,
        challenge: 'bell',
        structures: Array.from({ length: structures }, (_, i) => bridge(i)),
      },
      script: Array.from({ length: placed }, (_, i) => ({ tick: i, list: [place] })),
    };
  };
  // Bell allows 2 bridges.
  expect(SeedLinkSchema.safeParse(bell(1, 1)).success).toBe(true);
  expect(SeedLinkSchema.safeParse(bell(0, 2)).success).toBe(true);
  expect(SeedLinkSchema.safeParse(bell(1, 2)).success).toBe(false);
  expect(SeedLinkSchema.safeParse(bell(0, 3)).success).toBe(false);
  await expect(encodeLink(bell(2, 1))).rejects.toThrow();
  // Without a challenge there is no limit.
  const free = bell(2, 3);
  expect(SeedLinkSchema.safeParse({ ...free, setup: { ...free.setup, challenge: null } }).success).toBe(true);
});

test('fitsInLink is true at 2000 characters and false at 2001', () => {
  expect(LINK_CHARS).toBe(2000);
  expect(fitsInLink('x'.repeat(2000))).toBe(true);
  expect(fitsInLink('x'.repeat(2001))).toBe(false);
});
