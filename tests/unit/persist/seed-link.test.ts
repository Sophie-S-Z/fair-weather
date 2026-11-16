import { afterEach, expect, test, vi } from 'vitest';
import {
  LINK_CHARS,
  MAX_LINEAGE,
  MAX_LINK_BYTES,
  MAX_LINK_LISTS,
  MAX_LINK_TEXT,
  MAX_LINK_TICKS,
  SeedLinkSchema,
  VALLEY_FILE,
  decodeLink,
  encodeLink,
  fitsInLink,
  lineageOf,
  linkId,
} from '../../../src/persist/seed-link.ts';
import type { SeedLink } from '../../../src/persist/seed-link.ts';
import type { FromWorker, SimPort, WorldLite } from '../../../src/sim-host/protocol.ts';
import type { Command } from '../../../src/sim/types.ts';
import { DEFAULT_SWITCHES, createSandboxRunner } from '../../../src/story/sandbox.ts';
import { tuning } from '../../../src/story/tuning.ts';

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
    { tick: 9, list: [{ t: 'welcome', on: false }] },
  ],
  tick: 40,
  ...over,
});

/** A Kith carry creature. */
const creature = (id: string) => ({
  id,
  dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
  shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
  skyWarmth: 0,
  away: false,
  gone: false,
  diary: [],
});

/** A valid link whose JSON is exactly `bytes` long: one list of `welcome` commands, some `on: false`. */
function linkOfSize(bytes: number): SeedLink {
  const make = (k: number, off: number) =>
    link({
      script: [{ tick: 0, list: Array.from({ length: k }, (_, i) => ({ t: 'welcome', on: i >= off })) }],
    });
  const size = (l: SeedLink) => JSON.stringify(l).length; // ASCII only
  const k = Math.floor((bytes - size(make(0, 0))) / 26);
  const l = make(k, bytes - size(make(k, 0)));
  expect(size(l)).toBe(bytes);
  return l;
}

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
  // (atob ignores the unused low bits of the last character, so two texts can still decode to
  // the same link; bytes after the deflate end are refused in the next test.)
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

test('decode gives null for JSON that encode would not write: a duplicate key, spacing, odd numbers', async () => {
  const json = JSON.stringify(link());
  expect(await decodeLink(await rawLink(json), HASH)).toEqual(link());
  const caption = json.replace('"setup":', '"setup":{"caption":"our secret valley, love Ada"},"setup":');
  const note = json.replace('"tuning":', '"tuning":"Ada wrote this note","tuning":');
  const spaced = JSON.stringify(link(), null, 1);
  const zeros = json.replace('"seed":7', `"seed":7.${'0'.repeat(1000)}`);
  const { tick, ...rest } = link();
  const order = JSON.stringify({ tick, ...rest });
  for (const t of [caption, note, spaced, zeros, order]) {
    expect(JSON.parse(t)).toEqual(link());
    expect(t).not.toBe(json);
    expect(await decodeLink(await rawLink(t), HASH)).toBeNull();
  }
});

test('decode gives null for bytes after the deflate end: one to three extra characters, or words', async () => {
  const text = await encodeLink(link());
  expect(await decodeLink(text, HASH)).toEqual(link());
  // Each makes a length base64 cannot have, or adds whole bytes after the end.
  for (const extra of ['A', 'AA', 'AAA', 'AAAA', '_', '__'])
    expect(await decodeLink(text + extra, HASH)).toBeNull();
  for (const words of ['MeetMeAtTheOldMillAtNoonAda', 'AdaWroteThis', 'callMe5550100']) {
    // Padded to a length base64 can have: 1 mod 4 cannot be one.
    const padded = text + words + ((text.length - 3 + words.length) % 4 === 1 ? 'A' : '');
    expect(await decodeLink(padded, HASH)).toBeNull();
  }
});

test('decode gives null for a text longer than MAX_LINK_TEXT before it reads any of it', async () => {
  expect(MAX_LINK_TEXT).toBe(Math.ceil(((MAX_LINK_BYTES + 1024) * 4) / 3) + 3);
  // A real link padded with A to one character past the cap: refused before any inflate starts.
  const text = await encodeLink(link());
  const padded = text + 'A'.repeat(MAX_LINK_TEXT + 1 - text.length);
  expect((padded.length - 3) % 4).not.toBe(1);
  const Real = globalThis.DecompressionStream;
  let inflaters = 0;
  vi.stubGlobal('DecompressionStream', function (format: CompressionFormat) {
    inflaters += 1;
    return new Real(format);
  });
  expect(await decodeLink(padded, HASH)).toBeNull();
  expect(inflaters).toBe(0);
  expect(await decodeLink(padded.slice(0, -4), HASH)).toBeNull(); // under the cap, the tail is refused
  expect(inflaters).toBeGreaterThan(0);
  // The largest JSON a link may hold still fits under the text cap.
  const biggest = await encodeLink(linkOfSize(MAX_LINK_BYTES));
  expect(biggest.length).toBeLessThanOrEqual(MAX_LINK_TEXT);
});

test('decode stops at 1 MiB of inflated data and gives null', async () => {
  // Exactly MAX_LINK_BYTES of JSON decodes; one byte more does not, and encode refuses it.
  const most = linkOfSize(MAX_LINK_BYTES);
  expect(await decodeLink(await encodeLink(most), HASH)).toEqual(most);
  const over = linkOfSize(MAX_LINK_BYTES + 1);
  await expect(encodeLink(over)).rejects.toThrow();
  expect(await decodeLink(await rawLink(JSON.stringify(over)), HASH)).toBeNull();

  // A 16 MiB bomb: count what the inflater gives, to see that decode stops reading at the cap, and
  // the largest slice it is fed, so an engine that inflates a whole slice at once stays bounded.
  const bomb = await rawLink(' '.repeat(16 * MAX_LINK_BYTES));
  const Real = globalThis.DecompressionStream;
  let inflated = 0;
  let largestFed = 0;
  vi.stubGlobal('DecompressionStream', function (format: CompressionFormat) {
    const real = new Real(format);
    const feed = new TransformStream<BufferSource, BufferSource>({
      transform(chunk, c) {
        largestFed = Math.max(largestFed, chunk.byteLength);
        c.enqueue(chunk);
      },
    });
    feed.readable.pipeTo(real.writable).catch(() => undefined);
    const count = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, c) {
        inflated += chunk.byteLength;
        c.enqueue(chunk);
      },
    });
    return { writable: feed.writable, readable: real.readable.pipeThrough(count) };
  });
  expect(await decodeLink(bomb, HASH)).toBeNull();
  expect(inflated).toBeGreaterThan(MAX_LINK_BYTES);
  expect(inflated).toBeLessThan(MAX_LINK_BYTES + 256 * 1024);
  expect(largestFed).toBeGreaterThan(0);
  expect(largestFed).toBeLessThanOrEqual(1024);
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
  const kith = (c: object) => ({ ...base.setup, kith: { creatures: [c], ties: [] } });
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
    { ...base, setup: kith({ ...creature('pim'), name: 'Ada' }) },
    { ...base, setup: kith({ ...creature('pim'), dials: { ...creature('pim').dials, note: 1 } }) },
    { ...base, script: [{ tick: 0, list: [], note: 'hi' }] },
    { ...base, script: [{ tick: 0, list: [{ t: 'shine', x: 1, y: 1, caption: 'look' }] }] },
  ];
  expect(SeedLinkSchema.safeParse({ ...base, setup: kith(creature('pim')) }).success).toBe(true);
  for (const l of extra) await expect(encodeLink(l as SeedLink)).rejects.toThrow();

  const badIds = ['two words', 'x'.repeat(41), 'Ada', '', 'ada!', 'bench-1234567', 'newcomer-1234567'];
  for (const id of badIds) {
    const setups = [
      { ...base.setup, structures: [{ id, kind: 'bench' as const, x: 1, y: 1 }] },
      { ...base.setup, bushes: [{ id, x: 1, y: 1 }] },
      { ...base.setup, kith: { creatures: [creature(id)], ties: [] } },
    ];
    for (const setup of setups) await expect(encodeLink({ ...base, setup })).rejects.toThrow();
    // Every string a sandbox command names a creature with.
    const commands: SeedLink['script'][number]['list'] = [
      { t: 'thread', a: id, b: 'krit', on: true },
      { t: 'thread', a: 'pim', b: id, on: true },
      { t: 'whisper', target: id, about: 'krit', sign: -1 },
      { t: 'whisper', target: 'pim', about: id, sign: -1 },
    ];
    for (const c of commands)
      await expect(encodeLink({ ...base, script: [{ tick: 0, list: [c] }] })).rejects.toThrow();
  }
  // The sim's own ids pass: placed structures and bushes, newcomers, and every valley's creatures.
  const ok = {
    ...base,
    setup: {
      ...base.setup,
      kith: { creatures: [creature('newcomer-123456'), creature('bell')], ties: [] },
      structures: [{ id: 'lantern-999999', kind: 'lantern' as const, x: 1, y: 1 }],
      bushes: [{ id: 'path-12', x: 1, y: 1 }],
    },
    script: [
      { tick: 0, list: [{ t: 'thread' as const, a: 'starling-39', b: 'townsfolk-1', on: true }] },
      { tick: 0, list: [{ t: 'whisper' as const, target: 'wisp', about: 'quill', sign: 1 as const }] },
    ],
  };
  await expect(encodeLink(ok)).resolves.toMatch(/^v1\./);
  await expect(encodeLink({ ...base, tuning: 'ABCDEF12' })).rejects.toThrow();
  // The decoder refuses the same as the encoder: an extra field written past the schema.
  expect(await decodeLink(await rawLink(JSON.stringify({ ...base, name: 'Ada' })), HASH)).toBeNull();
});

test('id-shaped words are refused: every id comes from a closed set', async () => {
  const base = link();
  const structure = { id: 'meet-me-at-the-old-mill-at-noon-ada', kind: 'bench' as const, x: 1, y: 1 };
  const words: SeedLink[] = [
    { ...base, setup: { ...base.setup, structures: [structure] } },
    {
      ...base,
      script: [{ tick: 0, list: [{ t: 'thread', a: 'ada-loves-bob', b: 'call-555-0100', on: true }] }],
    },
    { ...base, setup: { ...base.setup, kith: { creatures: [creature('my-name-is-ada')], ties: [] } } },
    {
      ...base,
      setup: {
        ...base.setup,
        kith: { creatures: [creature('pim')], ties: [{ a: 'i-miss-you', b: 'come-home', ab: 0, ba: 0 }] },
      },
    },
  ];
  for (const l of words) await expect(encodeLink(l)).rejects.toThrow();
});

test('a link holds only the sandbox commands, as the runner sends them', async () => {
  const base = link();
  const { width, height } = tuning.scene;
  const { brushRadius, brushAmount } = tuning.fog;
  const one = (c: unknown, challenge: SeedLink['setup']['challenge'] = null) =>
    SeedLinkSchema.safeParse({
      ...base,
      setup: { ...base.setup, challenge },
      script: [{ tick: 0, list: [c] }],
    }).success;
  const allowed: unknown[] = [
    { t: 'place', kind: 'bush', x: 0, y: 0 },
    { t: 'path', x: 0, y: 0, x2: width, y2: height },
    { t: 'shine', x: width, y: height },
    { t: 'paintFog', x: 5, y: 5, r: brushRadius, amount: brushAmount },
    { t: 'paintFog', x: 5, y: 5, r: brushRadius, amount: -brushAmount },
    { t: 'blow', x: 5, y: 5, dx: 300, dy: -300 },
    { t: 'blow', x: 5, y: 5, dx: -2 * width, dy: 2 * height },
    { t: 'rain', x: 5, y: 5 },
    { t: 'thread', a: 'pim', b: 'krit', on: false },
    { t: 'whisper', target: 'pim', about: 'krit', sign: 1 },
    { t: 'welcome', on: true },
  ];
  for (const c of allowed) expect(one(c)).toBe(true);
  const refused: unknown[] = [
    { t: 'walk', x: 5, y: 5 },
    { t: 'walk', to: 'pim' },
    { t: 'wake', who: 'pim' },
    { t: 'respond', to: 'pim', reply: 'toward' },
    { t: 'arrangeMeeting', a: 'pim', b: 'krit' },
    { t: 'setSeason', season: 'winter' },
    { t: 'promptSkyBid', who: 'pim' },
    { t: 'overPoke' },
    { t: 'manner', reply: 'toward', gift: 'give' },
    { t: 'plant' },
    { t: 'local', verb: { verb: 'keepsake', to: 'pim', item: 'feather' } },
    { t: 'nudge', dial: 'ear', amount: 0.1 },
    { t: 'place', kind: 'bench', x: -1, y: 5 },
    { t: 'shine', x: width + 1, y: 5 },
    { t: 'rain', x: 5, y: height + 0.5 },
    { t: 'path', x: 0, y: 0, x2: width + 1, y2: 0 },
    { t: 'path', x: 0, y: 0, x2: 0, y2: -1 },
    { t: 'paintFog', x: -5, y: 5, r: brushRadius, amount: brushAmount },
    { t: 'paintFog', x: 5, y: 5, r: brushRadius + 1, amount: brushAmount },
    { t: 'paintFog', x: 5, y: 5, r: brushRadius, amount: 0.25 },
    { t: 'blow', x: 5, y: 5, dx: 2 * width + 1, dy: 0 },
    { t: 'blow', x: 5, y: 5, dx: 0, dy: -2 * height - 1 },
    { t: 'blow', x: 5, y: 5, dx: 1e308, dy: 0 },
    { t: 'blow', x: width + 1, y: 5, dx: 1, dy: 0 },
  ];
  for (const c of refused) expect(one(c), JSON.stringify(c)).toBe(false);
  // Bell's "Start the dance": Pim's, in a Bell link, once.
  const dance = { t: 'dance', who: 'pim' };
  expect(one(dance, 'bell')).toBe(true);
  expect(one(dance)).toBe(false);
  expect(one(dance, 'krit')).toBe(false);
  expect(one({ t: 'dance', who: 'krit' }, 'bell')).toBe(false);
  const twice = {
    ...base,
    setup: { ...base.setup, challenge: 'bell' },
    script: [
      { tick: 0, list: [dance] },
      { tick: 1, list: [dance] },
    ],
  };
  expect(SeedLinkSchema.safeParse(twice).success).toBe(false);
  await expect(encodeLink(twice as SeedLink)).rejects.toThrow();
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

test("fitsInLink takes a lower limit, as a dev build's ?linkChars=N sets", () => {
  expect(fitsInLink('x'.repeat(200), 200)).toBe(true);
  expect(fitsInLink('x'.repeat(201), 200)).toBe(false);
});

test('the runner refuses an off-scene point and clamps a path, so its sends always encode', async () => {
  const sent: Command[] = [];
  const listeners = new Set<(m: FromWorker) => void>();
  const port: SimPort = {
    send: (list) => sent.push(...list),
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('no hash')),
  };
  const runner = createSandboxRunner(port, link().setup);
  for (const cb of listeners) cb({ t: 'snapshot', tick: 1, lite: { water: [] } as unknown as WorldLite });
  // A tap in a portrait letterbox, above the scene.
  const at = { x: 820, y: -1117 };
  expect(runner.verb({ verb: 'shine', ...at })).toBe(false);
  expect(runner.verb({ verb: 'fog', ...at, clear: false })).toBe(false);
  expect(runner.verb({ verb: 'rain', ...at })).toBe(false);
  expect(runner.verb({ verb: 'blow', ...at, dx: 100, dy: 0 })).toBe(false);
  for (const kind of ['bush', 'lantern'] as const) {
    runner.setPlaceKind(kind);
    expect(runner.verb({ verb: 'place', ...at })).toBe(false);
  }
  expect(runner.verb({ verb: 'path', x: 100, y: 200, x2: 1700, y2: -50 })).toBe(true);
  expect(runner.verb({ verb: 'path', x: 100, y: 200, x2: Number.NaN, y2: 0 })).toBe(false);
  expect(runner.verb({ verb: 'shine', x: 1600, y: 900 })).toBe(true);
  expect(sent).toEqual([
    { t: 'path', x: 100, y: 200, x2: 1600, y2: 0 },
    { t: 'shine', x: 1600, y: 900 },
  ]);
  const text = await encodeLink(link({ script: [{ tick: 1, list: sent }], tick: 2 }));
  expect(await decodeLink(text, HASH)).not.toBeNull();
  runner.dispose();
});

test('linkId is 32-bit FNV-1a in 8 hex digits; a lineage keeps the last MAX_LINEAGE ids', () => {
  expect(linkId('')).toBe('811c9dc5');
  expect(linkId('a')).toBe('e40c292c');
  expect(linkId('v1.abc')).toMatch(/^[0-9a-f]{8}$/);
  const long = Array.from({ length: MAX_LINEAGE }, (_, i) => i.toString(16).padStart(8, '0'));
  const lineage = lineageOf(link({ from: long }), 'v1.x');
  expect(lineage).toHaveLength(MAX_LINEAGE);
  expect(lineage.at(-1)).toBe(linkId('v1.x'));
  expect(lineage[0]).toBe(long[1]);
  expect(lineageOf(link(), 'v1.x')).toEqual([linkId('v1.x')]);
});

test('a link with a lineage round-trips; an empty or long lineage and a bad id are refused; an M4 link still opens', async () => {
  const from = { from: ['0badf00d', 'deadbeef'] };
  expect(await decodeLink(await encodeLink(link(from)), HASH)).toEqual(link(from));
  const ids = (n: number) => Array.from({ length: n }, () => '0badf00d');
  for (const bad of [[], ids(MAX_LINEAGE + 1), ['0BADF00D'], ['my-friend']])
    expect(SeedLinkSchema.safeParse(link({ from: bad })).success, JSON.stringify(bad)).toBe(false);
  expect(SeedLinkSchema.safeParse(link({ from: ids(MAX_LINEAGE) })).success).toBe(true);
  expect('from' in link()).toBe(false);
  expect(await decodeLink(await encodeLink(link()), HASH)).toEqual(link());
});
