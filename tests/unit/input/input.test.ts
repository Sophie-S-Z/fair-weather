import { describe, expect, it } from 'vitest';
import { createKeyboard, type InputContext } from '../../../src/input/keyboard.ts';
import { createHints, type HintTimer } from '../../../src/input/hints.ts';
import { createOverPoke } from '../../../src/input/over-poke.ts';
import { createPointer } from '../../../src/input/pointer.ts';
import type { VerbInput } from '../../../src/story/verbs.ts';

function setup(over: Partial<InputContext> = {}) {
  const t = new EventTarget();
  const acts: VerbInput[] = [];
  const sel: (string | null)[] = [];
  let cursor = { x: 100, y: 100 };
  let paused = 0;
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
    cursor: () => cursor,
    act: (v) => acts.push(v),
    togglePause: () => paused++,
    select: (id) => sel.push(id),
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
  return { press, acts, sel, dispose, cursor: () => cursor, paused: () => paused, t };
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

describe('pointer', () => {
  it('selects and wakes through pick', () => {
    const t = new EventTarget();
    const acts: VerbInput[] = [];
    const sel: (string | null)[] = [];
    const off = createPointer(t, () => ({ creature: 'a' }), {
      select: (i) => sel.push(i),
      act: (v) => acts.push(v),
      tool: () => 'wake',
    });
    t.dispatchEvent(Object.assign(new Event('pointerdown'), { button: 0, clientX: 1, clientY: 2 }));
    expect(sel).toEqual(['a']);
    expect(acts).toEqual([{ verb: 'wake', who: 'a' }]);
    off();
    t.dispatchEvent(Object.assign(new Event('pointerdown'), { button: 0 }));
    expect(acts.length).toBe(1);
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

describe('hints', () => {
  function fakeTimer() {
    let fn: (() => void) | null = null;
    const timer: HintTimer = {
      set: (f) => ((fn = f), 1),
      clear: () => (fn = null),
    };
    return {
      timer,
      fire: () => {
        const f2 = fn;
        fn = null;
        f2?.();
      },
      armed: () => fn !== null,
    };
  }
  it('fires once per verb after idle; activity resets; never repeats', () => {
    const f = fakeTimer();
    const h = createHints(10000, f.timer);
    const got: string[] = [];
    h.onHint((v) => got.push(v));
    h.unlock('wake');
    h.activity();
    f.fire();
    expect(got).toEqual(['wake']);
    expect(f.armed()).toBe(false);
    h.unlock('wake');
    expect(f.armed()).toBe(false);
    h.unlock('respond');
    f.fire();
    expect(got).toEqual(['wake', 'respond']);
    h.dispose();
  });
});
