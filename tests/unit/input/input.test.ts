import { describe, expect, it } from 'vitest';
import { createKeyboard, type InputContext } from '../../../src/input/keyboard.ts';
import { createHints, type HintTimer } from '../../../src/input/hints.ts';
import { createOverPoke } from '../../../src/input/over-poke.ts';
import { createPointer } from '../../../src/input/pointer.ts';
import type { BidReply } from '../../../src/sim/types.ts';
import type { Verb, VerbInput } from '../../../src/story/verbs.ts';

function setup(over: Partial<InputContext> = {}) {
  const t = new EventTarget();
  const acts: VerbInput[] = [];
  const sel: (string | null)[] = [];
  let cursor = { x: 100, y: 100 };
  let paused = 0;
  let tool: Verb | null = null;
  let reply: BidReply = 'toward';
  let picked: string | null = null;
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
    ...over,
  };
  const dispose = createKeyboard(t, ctx);
  const press = (key: string, init: Record<string, unknown> = {}) => {
    const { target, ...rest } = init;
    const e = Object.assign(new Event('keydown', { cancelable: true }), { key, ...rest });
    if (target !== undefined) Object.defineProperty(e, 'target', { value: target });
    t.dispatchEvent(e);
    return e;
  };
  return { press, acts, sel, dispose, cursor: () => cursor, paused: () => paused, reply: () => reply, t };
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

describe('pointer', () => {
  function mk(tool: Verb | null) {
    const t = new EventTarget();
    const acts: VerbInput[] = [];
    const sel: (string | null)[] = [];
    const off = createPointer(
      t,
      () => ({ creature: 'a' }),
      (x, y) => ({ x: x * 2, y: y * 2 }),
      {
        select: (i) => sel.push(i),
        act: (v) => acts.push(v),
        tool: () => tool,
        benchSpots: () => [
          { id: 'one', x: 600, y: 430 },
          { id: 'two', x: 1050, y: 300 },
        ],
      },
    );
    const down = (x = 1, y = 2) =>
      t.dispatchEvent(Object.assign(new Event('pointerdown'), { button: 0, clientX: x, clientY: y }));
    return { acts, sel, off, down };
  }
  it('selects and wakes through pick', () => {
    const m = mk('wake');
    m.down();
    expect(m.sel).toEqual(['a']);
    expect(m.acts).toEqual([{ verb: 'wake', who: 'a' }]);
    m.off();
    m.down();
    expect(m.acts.length).toBe(1);
  });
  it('place snaps the clicked scene point to the nearest bench', () => {
    const m = mk('place');
    m.down(500, 200);
    m.down(520, 140);
    expect(m.acts).toEqual([
      { verb: 'place', x: 1050, y: 300 },
      { verb: 'place', x: 1050, y: 300 },
    ]);
    m.down(280, 200);
    expect(m.acts[2]).toEqual({ verb: 'place', x: 600, y: 430 });
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
