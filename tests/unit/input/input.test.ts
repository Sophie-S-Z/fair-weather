import { describe, expect, it } from 'vitest';
import { createKeyboard, type InputContext } from '../../../src/input/keyboard.ts';
import { createHints, type HintTimer } from '../../../src/input/hints.ts';
import { createOverPoke } from '../../../src/input/over-poke.ts';
import { createPointer } from '../../../src/input/pointer.ts';
import { keyboardTools, snapToWater } from '../../../src/input/verbs.ts';
import type { BidReply } from '../../../src/sim/types.ts';
import type { Verb, VerbInput } from '../../../src/story/verbs.ts';

/** A context whose writes land in the returned logs. */
function context(over: Partial<InputContext> = {}) {
  const acts: VerbInput[] = [];
  const sel: (string | null)[] = [];
  const zooms: ('in' | 'out')[] = [];
  const whispers: string[] = [];
  let cursor = { x: 100, y: 100 };
  let paused = 0;
  let tool: Verb | null = null;
  let reply: BidReply = 'toward';
  let picked: string | null = null;
  let threadFrom: string | null = null;
  const ctx: InputContext = {
    tools: () => ['wake', 'respond', 'place'],
    creatures: () => [
      { id: 'a', state: 'wander' },
      { id: 'b', state: 'away' },
      { id: 'c', state: 'sleep' },
    ],
    benchSpots: () => [
      { id: 'one', x: 600, y: 430 },
      { id: 'two', x: 1050, y: 300 },
    ],
    tool: () => tool,
    setTool: (v) => {
      tool = v;
    },
    reply: () => reply,
    setReply: (r) => {
      reply = r;
    },
    cursor: () => cursor,
    act: (v) => acts.push(v),
    togglePause: () => paused++,
    picked: () => picked,
    select: (id) => {
      picked = id;
      sel.push(id);
    },
    moveCursor: (p) => (cursor = p),
    placeKind: () => 'bench',
    view: () => 'meadow',
    zoom: (dir) => zooms.push(dir),
    water: () => [],
    isFriend: (a, b) => (a === 'a' && b === 'c') || (a === 'c' && b === 'a'),
    threadFrom: () => threadFrom,
    setThreadFrom: (id) => (threadFrom = id),
    openWhisper: (target) => whispers.push(target),
    manner: () => ({ reply: 'toward', gift: 'give' }),
    heroKind: () => 'lantern',
    heroFlying: () => false,
    keepsakes: () => ['starling-feather', 'clipping'],
    ...over,
  };
  return {
    ctx,
    acts,
    sel,
    zooms,
    whispers,
    cursor: () => cursor,
    paused: () => paused,
    reply: () => reply,
    threadFrom: () => threadFrom,
  };
}

function setup(over: Partial<InputContext> = {}) {
  const t = new EventTarget();
  const c = context(over);
  const dispose = createKeyboard(t, c.ctx);
  const press = (key: string, init: Record<string, unknown> = {}) => {
    const { target, ...rest } = init;
    const e = Object.assign(new Event('keydown', { cancelable: true }), { key, shiftKey: false, ...rest });
    if (target !== undefined) Object.defineProperty(e, 'target', { value: target });
    t.dispatchEvent(e);
    return e;
  };
  return { ...c, press, dispose, t };
}

describe('keyboard', () => {
  it('Tab cycles in id order skipping away, Shift+Tab reverses; Enter wakes', () => {
    const s = setup();
    s.press('Tab');
    s.press('Tab');
    s.press('Tab');
    s.press('Tab', { shiftKey: true });
    expect(s.sel).toEqual(['a', 'c', 'a', 'c']);
    s.press('Enter');
    expect(s.acts).toEqual([{ verb: 'wake', who: 'c' }]);
  });
  it('arrows move 20 units, Space pauses', () => {
    const s = setup();
    s.press('ArrowRight');
    s.press('ArrowDown');
    expect(s.cursor()).toEqual({ x: 120, y: 120 });
    s.press(' ');
    expect(s.paused()).toBe(1);
  });
  it('1-3 pick tools; respond sends the chosen reply; place snaps to a bench', () => {
    const s = setup();
    s.press('2');
    s.press('Enter');
    s.press('r');
    expect(s.reply()).toBe('against');
    s.press('Enter');
    s.press('3');
    s.press('Enter');
    expect(s.acts).toEqual([
      { verb: 'respond', reply: 'toward' },
      { verb: 'respond', reply: 'against' },
      { verb: 'place', x: 600, y: 430 },
    ]);
  });
  it('ignores modifiers and text inputs, and dispose removes listeners', () => {
    const s = setup();
    s.press('Tab', { ctrlKey: true });
    const e = s.press('Tab', { target: { tagName: 'INPUT' } });
    expect(s.sel).toEqual([]);
    expect(e.defaultPrevented).toBe(false);
    s.dispose();
    s.press('Tab');
    expect(s.sel).toEqual([]);
  });
  it('keyboardTools keeps the world verbs only', () => {
    expect(keyboardTools(['wake', 'bet', 'peek', 'zoom', 'listen', 'rewind', 'place'])).toEqual([
      'wake',
      'place',
    ]);
  });
  it('never offers bet as a keyboard tool', () => {
    const s = setup({ tools: () => ['wake', 'bet'] });
    s.press('2');
    s.press('Tab');
    s.press('Enter');
    expect(s.acts).toEqual([{ verb: 'wake', who: 'a' }]);
  });
});

describe('keyboard extras', () => {
  it('G and H pick the other replies; tool lives in ctx', () => {
    const s = setup();
    s.press('2');
    s.press('h');
    s.press('Enter');
    s.press('g');
    s.press('Enter');
    expect(s.acts).toEqual([
      { verb: 'respond', reply: 'away' },
      { verb: 'respond', reply: 'toward' },
    ]);
  });
  it('Tab with only away or no creatures does nothing and keeps default', () => {
    for (const list of [[{ id: 'b', state: 'away' }], []]) {
      const s = setup({ creatures: () => list });
      const e = s.press('Tab');
      s.press('Tab', { shiftKey: true });
      expect(s.sel).toEqual([]);
      expect(e.defaultPrevented).toBe(false);
    }
  });
  it('Z X J B ? are unhandled', () => {
    const s = setup();
    for (const k of ['z', 'x', 'j', 'b', '?']) {
      const e = s.press(k);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(s.acts).toEqual([]);
    expect(s.sel).toEqual([]);
    expect(s.paused()).toBe(0);
  });
  it('Enter and Space on a button are left to native activation', () => {
    const s = setup();
    s.press('Tab');
    const e = s.press(' ', { target: { tagName: 'BUTTON' } });
    s.press('Enter', { target: { tagName: 'A' } });
    expect(e.defaultPrevented).toBe(false);
    expect(s.paused()).toBe(0);
    expect(s.acts).toEqual([]);
  });
  it('Enter acts on the creature the shared pick holds, also when a click changed it', () => {
    let shared: string | null = null;
    const s = setup({
      picked: () => shared,
      select: (id) => (shared = id),
    });
    s.press('Tab'); // picks 'a'
    shared = 'c'; // a click picked 'c' through the same owner
    s.press('Enter');
    expect(s.acts).toEqual([{ verb: 'wake', who: 'c' }]);
    shared = null; // the next chapter clears the pick
    s.press('Enter');
    expect(s.acts).toHaveLength(1);
  });
  it('Shift+Tab from none selects the last awake creature', () => {
    const s = setup();
    s.press('Tab', { shiftKey: true });
    expect(s.sel).toEqual(['c']);
  });
});

describe('Part 1 tools by keyboard', () => {
  const WATER = [{ x: 700, y: 200, w: 100, h: 300 }];
  it('Z zooms out and X in only while zoom is unlocked', () => {
    const locked = setup();
    locked.press('z');
    locked.press('x');
    expect(locked.zooms).toEqual([]);
    const s = setup({ tools: () => ['wake', 'zoom'] });
    s.press('z');
    s.press('X');
    expect(s.zooms).toEqual(['out', 'in']);
  });
  it('shine and fog act at the cursor; Shift+Enter clears fog', () => {
    const s = setup({ tools: () => ['shine', 'fog'] });
    s.press('Enter');
    s.press('2');
    s.press('Enter');
    s.press('Enter', { shiftKey: true });
    expect(s.acts).toEqual([
      { verb: 'shine', x: 100, y: 100 },
      { verb: 'fog', x: 100, y: 100, clear: false },
      { verb: 'fog', x: 100, y: 100, clear: true },
    ]);
  });
  it('blow gusts 300 units east before any arrow, then in the last arrow direction', () => {
    const s = setup({ tools: () => ['blow'] });
    s.press('Enter');
    s.press('ArrowUp');
    s.press('Enter');
    s.press('ArrowLeft');
    s.press('Enter');
    expect(s.acts).toEqual([
      { verb: 'blow', x: 100, y: 100, dx: 300, dy: 0 },
      { verb: 'blow', x: 100, y: 80, dx: 0, dy: -300 },
      { verb: 'blow', x: 80, y: 80, dx: -300, dy: 0 },
    ]);
  });
  it('place sets a lantern at the cursor, and a bridge into the nearest water or not at all', () => {
    const lantern = setup({ tools: () => ['place'], placeKind: () => 'lantern' });
    lantern.press('Enter');
    expect(lantern.acts).toEqual([{ verb: 'place', x: 100, y: 100 }]);
    const dry = setup({ tools: () => ['place'], placeKind: () => 'bridge' });
    dry.press('Enter');
    expect(dry.acts).toEqual([]);
    const wet = setup({ tools: () => ['place'], placeKind: () => 'bridge', water: () => WATER });
    wet.press('Enter');
    expect(wet.acts).toEqual([{ verb: 'place', x: 700, y: 200 }]);
  });
  it('whisper opens the card for the picked creature, and nothing with none picked', () => {
    const s = setup({ tools: () => ['whisper'] });
    s.press('Enter');
    s.press('Tab');
    expect(s.press('Enter').defaultPrevented).toBe(true);
    expect(s.whispers).toEqual(['a']);
    expect(s.acts).toEqual([]);
  });
  it('thread marks the picked creature; Enter on another ties or cuts by friendship', () => {
    const s = setup({ tools: () => ['thread'] });
    s.press('Tab'); // a
    s.press('Enter');
    expect(s.threadFrom()).toBe('a');
    s.press('Enter'); // the same creature again: nothing
    s.press('Tab'); // c, a friend of a
    s.press('Enter');
    expect(s.threadFrom()).toBeNull();
    s.press('Enter'); // marks c
    s.press('Tab'); // a
    s.press('Enter');
    expect(s.acts).toEqual([
      { verb: 'thread', a: 'a', b: 'c', on: false },
      { verb: 'thread', a: 'c', b: 'a', on: false },
    ]);
  });
  it('thread ties creatures that are not friends', () => {
    const s = setup({ tools: () => ['thread'], isFriend: () => false });
    s.press('Tab');
    s.press('Enter');
    s.press('Tab');
    s.press('Enter');
    expect(s.acts).toEqual([{ verb: 'thread', a: 'a', b: 'c', on: true }]);
  });
  it('Escape clears the thread mark and claims the key only then', () => {
    const s = setup({ tools: () => ['thread'] });
    expect(s.press('Escape').defaultPrevented).toBe(false);
    s.press('Tab');
    s.press('Enter');
    expect(s.press('Escape').defaultPrevented).toBe(true);
    expect(s.threadFrom()).toBeNull();
    s.press('Tab');
    s.press('Enter');
    expect(s.acts).toEqual([]);
  });
  it('snapToWater clamps into the nearest rectangle, and is null with none', () => {
    const two = [...WATER, { x: 0, y: 0, w: 50, h: 50 }];
    expect(snapToWater({ x: 750, y: 600 }, two)).toEqual({ x: 750, y: 500 });
    expect(snapToWater({ x: 60, y: 10 }, two)).toEqual({ x: 50, y: 10 });
    expect(snapToWater({ x: 720, y: 300 }, two)).toEqual({ x: 720, y: 300 });
    expect(snapToWater({ x: 1, y: 1 }, [])).toBeNull();
  });
});

describe('pointer', () => {
  /** Node positions by client point; `pick` snaps to whichever is within 10 pixels. */
  const A = { x: 10, y: 10 };
  const B = { x: 200, y: 10 };
  const C = { x: 100, y: 100 };
  const NODES = Object.entries({ a: A, b: B, c: C });
  function mk(tool: Verb, over: Partial<InputContext> = {}) {
    const t = new EventTarget();
    const c = context({ tools: () => [tool, 'zoom'], ...over });
    c.ctx.setTool(tool);
    const pick = (x: number, y: number) => ({
      creature: NODES.find(([, n]) => Math.hypot(n.x - x, n.y - y) <= 10)?.[0] ?? null,
    });
    const off = createPointer(t, pick, (x, y) => ({ x: x * 2, y: y * 2 }), c.ctx);
    const fire = (type: string, init: Record<string, unknown>) => {
      const e = Object.assign(new Event(type, { cancelable: true }), {
        button: 0,
        pointerId: 1,
        isPrimary: true,
        shiftKey: false,
        ...init,
      });
      t.dispatchEvent(e);
      return e;
    };
    const down = (x: number, y: number, id = 1) =>
      fire('pointerdown', { clientX: x, clientY: y, pointerId: id, isPrimary: id === 1 });
    const move = (x: number, y: number, id = 1) =>
      fire('pointermove', { clientX: x, clientY: y, pointerId: id, isPrimary: id === 1 });
    const up = (x: number, y: number, id = 1, shiftKey = false) =>
      fire('pointerup', { clientX: x, clientY: y, pointerId: id, isPrimary: id === 1, shiftKey });
    const click = (x: number, y: number) => {
      down(x, y);
      up(x, y);
    };
    const drag = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      down(from.x, from.y);
      move(to.x, to.y);
      up(to.x, to.y);
    };
    const wheel = (deltaY: number, timeStamp: number) => {
      const e = Object.assign(new Event('wheel', { cancelable: true }), { deltaY });
      Object.defineProperty(e, 'timeStamp', { value: timeStamp });
      t.dispatchEvent(e);
      return e;
    };
    return { ...c, off, down, move, up, click, drag, wheel };
  }

  it('a click selects and wakes through pick; dispose removes the listeners', () => {
    const m = mk('wake');
    m.click(10, 12);
    expect(m.sel).toEqual(['a']);
    expect(m.acts).toEqual([{ verb: 'wake', who: 'a' }]);
    m.off();
    m.click(10, 12);
    expect(m.acts.length).toBe(1);
  });
  it('a click with place snaps the scene point to the nearest bench, and moves the cursor there', () => {
    const m = mk('place');
    m.click(500, 200);
    m.click(280, 200);
    expect(m.acts).toEqual([
      { verb: 'place', x: 1050, y: 300 },
      { verb: 'place', x: 600, y: 430 },
    ]);
    expect(m.cursor()).toEqual({ x: 560, y: 400 });
  });
  it('a click acts as Enter at its scene point: shine, fog (Shift clears), a gust east', () => {
    const shine = mk('shine');
    shine.click(30, 40);
    const fog = mk('fog');
    fog.down(30, 40);
    fog.up(30, 40, 1, true);
    const blow = mk('blow');
    blow.click(30, 40);
    expect([...shine.acts, ...fog.acts, ...blow.acts]).toEqual([
      { verb: 'shine', x: 60, y: 80 },
      { verb: 'fog', x: 60, y: 80, clear: true },
      { verb: 'blow', x: 60, y: 80, dx: 300, dy: 0 },
    ]);
  });
  it('a click with whisper opens the card for the creature it picks', () => {
    const m = mk('whisper');
    m.click(100, 100);
    expect(m.whispers).toEqual(['c']);
  });
  it('a blow drag of 40 pixels or more sends the drag as the gust; a shorter one is a click', () => {
    const m = mk('blow');
    m.drag({ x: 10, y: 50 }, { x: 34, y: 82 }); // 40 pixels
    m.drag({ x: 10, y: 50 }, { x: 30, y: 50 }); // 20 pixels: a click at its end
    expect(m.acts).toEqual([
      { verb: 'blow', x: 20, y: 100, dx: 48, dy: 64 },
      { verb: 'blow', x: 60, y: 100, dx: 300, dy: 0 },
    ]);
  });
  it('a long drag with any other tool is a click at its release point', () => {
    const m = mk('shine');
    m.drag({ x: 10, y: 50 }, { x: 200, y: 50 });
    expect(m.acts).toEqual([{ verb: 'shine', x: 400, y: 100 }]);
  });
  it('a thread drag in Cosmos from node to node cuts a friendship or ties strangers', () => {
    const m = mk('thread', { view: () => 'cosmos' });
    m.drag(A, { x: 105, y: 95 });
    const strangers = mk('thread', { view: () => 'cosmos', isFriend: () => false });
    strangers.drag(C, { x: 12, y: 8 });
    expect([...m.acts, ...strangers.acts]).toEqual([
      { verb: 'thread', a: 'a', b: 'c', on: false },
      { verb: 'thread', a: 'c', b: 'a', on: true },
    ]);
  });
  it('a thread drag ending on its start, on no node, or on an away creature sends nothing', () => {
    const m = mk('thread', { view: () => 'cosmos' });
    m.drag(A, { x: 4, y: 4 });
    m.drag(A, { x: 60, y: 60 });
    m.drag(C, B); // b is away
    m.drag(B, C);
    expect(m.acts).toEqual([]);
  });
  it('a thread drag in the Meadow only marks where it ends; a click on another then threads', () => {
    const m = mk('thread');
    m.drag(A, C);
    expect(m.acts).toEqual([]);
    expect(m.threadFrom()).toBe('c');
    m.click(10, 10);
    expect(m.acts).toEqual([{ verb: 'thread', a: 'c', b: 'a', on: false }]);
  });
  it('the wheel zooms one step per 300 ms, and not while zoom is locked', () => {
    const m = mk('wake');
    expect(m.wheel(100, 1000).defaultPrevented).toBe(true);
    m.wheel(100, 1100);
    m.wheel(-100, 1299);
    m.wheel(-100, 1300);
    expect(m.zooms).toEqual(['out', 'in']);
    const locked = mk('wake', { tools: () => ['wake'] });
    expect(locked.wheel(100, 1000).defaultPrevented).toBe(false);
    expect(locked.zooms).toEqual([]);
  });
  it('a two-pointer spread zooms in once and a pinch zooms out once per gesture, and neither clicks', () => {
    const m = mk('wake');
    m.down(100, 100, 1);
    m.down(200, 100, 2); // 100 apart
    m.move(230, 100, 2); // 1.3
    m.move(300, 100, 2); // 2.0: the same gesture
    m.up(300, 100, 2);
    m.up(100, 100, 1);
    m.down(100, 100, 1);
    m.down(200, 100, 2);
    m.move(170, 100, 2); // 0.7
    m.move(120, 100, 2);
    m.up(120, 100, 2);
    m.up(100, 100, 1);
    expect(m.zooms).toEqual(['in', 'out']);
    expect(m.sel).toEqual([]);
    expect(m.acts).toEqual([]);
  });
  it('a spread between 0.8 and 1.25 times does not zoom', () => {
    const m = mk('wake');
    m.down(100, 100, 1);
    m.down(200, 100, 2);
    m.move(224, 100, 2);
    m.move(181, 100, 2);
    expect(m.zooms).toEqual([]);
  });
  it('a primary pointer down forgets a pointer whose up was lost', () => {
    const m = mk('wake');
    m.down(100, 100, 2); // its up lands outside the target
    m.click(10, 10);
    expect(m.acts).toEqual([{ verb: 'wake', who: 'a' }]);
  });
});

describe('over-poke', () => {
  it('fires on the 9th poke in 30s and resets', () => {
    const now = 0;
    const o = createOverPoke(30, 8, () => now);
    const r = Array.from({ length: 9 }, () => o.poke());
    expect(r.indexOf(true)).toBe(8);
    expect(r.filter(Boolean).length).toBe(1);
    expect(o.poke()).toBe(false);
  });
  it('does not fire when pokes spread past the window', () => {
    let now = 0;
    const o = createOverPoke(30, 8, () => now);
    for (let i = 0; i < 20; i++) {
      now += 5000;
      expect(o.poke()).toBe(false);
    }
  });
});

describe('over-poke window', () => {
  it('pokes exactly 30 s old have expired; expiry then fire', () => {
    let now = 0;
    const o = createOverPoke(30, 8, () => now);
    for (let i = 0; i < 8; i++) expect(o.poke()).toBe(false);
    now = 30000;
    expect(o.poke()).toBe(false);
    for (let i = 0; i < 7; i++) expect(o.poke()).toBe(false);
    expect(o.poke()).toBe(true);
  });
  it('pokes 29.999 s apart still count', () => {
    let now = 0;
    const o = createOverPoke(30, 8, () => now);
    for (let i = 0; i < 8; i++) o.poke();
    now = 29999;
    expect(o.poke()).toBe(true);
  });
});

describe('hints', () => {
  function fakeTimers() {
    let now = 0;
    let next = 1;
    const jobs = new Map<number, { at: number; fn: () => void }>();
    const delays: number[] = [];
    const timer: HintTimer = {
      set: (fn, ms) => {
        delays.push(ms);
        const id = next++;
        jobs.set(id, { at: now + ms, fn });
        return id;
      },
      clear: (h) => {
        jobs.delete(h as number);
      },
    };
    const advance = (ms: number) => {
      now += ms;
      for (const [id, j] of [...jobs]) {
        if (j.at <= now) {
          jobs.delete(id);
          j.fn();
        }
      }
    };
    return { timer, advance, delays };
  }
  it('fires once per verb after 10 s idle; activity resets; never repeats', () => {
    const f = fakeTimers();
    const h = createHints(10000, f.timer);
    const got: string[] = [];
    h.onHint((v) => got.push(v));
    h.unlock('wake');
    expect(f.delays).toEqual([10000]);
    f.advance(9000);
    h.activity();
    f.advance(9999);
    expect(got).toEqual([]);
    f.advance(1);
    expect(got).toEqual(['wake']);
    h.unlock('wake');
    f.advance(60000);
    expect(got).toEqual(['wake']);
    h.unlock('respond');
    f.advance(10000);
    expect(got).toEqual(['wake', 'respond']);
    h.dispose();
  });
  it('a used verb never gets its ghost hand; the next pending verb still does', () => {
    const f = fakeTimers();
    const h = createHints(10000, f.timer);
    const got: string[] = [];
    h.onHint((v) => got.push(v));
    h.unlock('wake');
    h.unlock('respond');
    f.advance(5000);
    h.used('wake');
    f.advance(9999);
    expect(got).toEqual([]);
    f.advance(1);
    expect(got).toEqual(['respond']);
    h.unlock('wake');
    f.advance(60000);
    expect(got).toEqual(['respond']);
    h.used('place');
    h.unlock('place');
    f.advance(60000);
    expect(got).toEqual(['respond']);
    h.dispose();
  });
});

describe('Part 2 tools', () => {
  const PART2: Verb[] = ['walk', 'manner', 'join'];
  it('Walk: Enter walks to the cursor; W waves at the picked creature, and sends nothing with no pick', () => {
    const s = setup({ tools: () => PART2 });
    s.press('w');
    s.press('Enter');
    s.press('Tab');
    s.press('w');
    expect(s.acts).toEqual([
      { verb: 'walk', x: 100, y: 100 },
      { verb: 'walk', to: 'a' },
    ]);
  });
  it('Walk: W never waves at the hero itself', () => {
    const s = setup({ tools: () => PART2, picked: () => 'hero' });
    s.press('w');
    expect(s.acts).toEqual([]);
  });
  it('Manner: G, H, R set the reply and O, K set Give or Keep, each keeping the other half', () => {
    const s = setup({ tools: () => PART2, manner: () => ({ reply: 'away', gift: 'keep' }) });
    s.press('2');
    for (const k of ['g', 'h', 'r', 'o', 'k']) s.press(k);
    expect(s.acts).toEqual([
      { verb: 'manner', reply: 'toward', gift: 'keep' },
      { verb: 'manner', reply: 'away', gift: 'keep' },
      { verb: 'manner', reply: 'against', gift: 'keep' },
      { verb: 'manner', reply: 'away', gift: 'give' },
      { verb: 'manner', reply: 'away', gift: 'keep' },
    ]);
  });
  it('the manner keys do nothing with another tool', () => {
    const s = setup({ tools: () => PART2 });
    for (const k of ['g', 'o', 'k', 'l']) s.press(k);
    expect(s.acts).toEqual([]);
  });
  it('Manner: L plants for a Seedcarrier, and sends nothing for another kind', () => {
    const seed = setup({ tools: () => PART2, heroKind: () => 'seedcarrier' });
    seed.press('2');
    seed.press('l');
    const lantern = setup({ tools: () => PART2 });
    lantern.press('2');
    lantern.press('l');
    expect(seed.acts).toEqual([{ verb: 'plant' }]);
    expect(lantern.acts).toEqual([]);
  });
  it('Join: Enter flies, or lands while flying', () => {
    const up = setup({ tools: () => PART2 });
    up.press('3');
    up.press('Enter');
    const down = setup({ tools: () => PART2, heroFlying: () => true });
    down.press('3');
    down.press('Enter');
    expect([...up.acts, ...down.acts]).toEqual([
      { verb: 'join', on: true },
      { verb: 'join', on: false },
    ]);
  });
  it('Pose: Enter poses', () => {
    const s = setup({ tools: () => ['walk', 'pose', 'manner'] });
    s.press('2');
    s.press('Enter');
    expect(s.acts).toEqual([{ verb: 'pose' }]);
  });
  it('Keepsake: Enter gives the first keepsake held to the picked creature; nothing with no pick or none held', () => {
    const s = setup({ tools: () => ['walk', 'keepsake', 'manner'] });
    s.press('2');
    s.press('Enter');
    s.press('Tab');
    s.press('Enter');
    const none = setup({ tools: () => ['walk', 'keepsake', 'manner'], keepsakes: () => [] });
    none.press('2');
    none.press('Tab');
    none.press('Enter');
    expect([...s.acts, ...none.acts]).toEqual([{ verb: 'keepsake', to: 'a', item: 'starling-feather' }]);
  });
});

describe('Part 2 pointer', () => {
  function mk(tool: Verb, over: Partial<InputContext> = {}) {
    const t = new EventTarget();
    const c = context({ tools: () => [tool], ...over });
    c.ctx.setTool(tool);
    const pick = (x: number, y: number) => ({
      creature: x === 10 && y === 10 ? 'a' : x === 50 && y === 50 ? 'hero' : null,
    });
    createPointer(t, pick, (x, y) => ({ x: x * 2, y: y * 2 }), c.ctx);
    const click = (x: number, y: number) => {
      for (const type of ['pointerdown', 'pointerup'])
        t.dispatchEvent(
          Object.assign(new Event(type), {
            button: 0,
            pointerId: 1,
            isPrimary: true,
            clientX: x,
            clientY: y,
          }),
        );
    };
    return { ...c, click };
  }
  it('with Walk, a click on ground walks there and moves the cursor; a click on a creature waves at it', () => {
    const m = mk('walk');
    m.click(30, 40);
    m.click(10, 10);
    m.click(50, 50); // the hero itself is ground
    expect(m.acts).toEqual([
      { verb: 'walk', x: 60, y: 80 },
      { verb: 'walk', to: 'a' },
      { verb: 'walk', x: 100, y: 100 },
    ]);
    expect(m.sel).toEqual(['a']);
    expect(m.cursor()).toEqual({ x: 100, y: 100 });
  });
  it('with Manner or Keepsake, a click only picks: their buttons act', () => {
    const manner = mk('manner');
    manner.click(10, 10);
    const keep = mk('keepsake');
    keep.click(10, 10);
    expect([...manner.sel, ...keep.sel]).toEqual(['a', 'a']);
    expect([...manner.acts, ...keep.acts]).toEqual([]);
  });
  it('with Join or Pose, a click acts as Enter', () => {
    const join = mk('join');
    join.click(30, 40);
    const pose = mk('pose');
    pose.click(30, 40);
    expect([...join.acts, ...pose.acts]).toEqual([{ verb: 'join', on: true }, { verb: 'pose' }]);
  });
});
