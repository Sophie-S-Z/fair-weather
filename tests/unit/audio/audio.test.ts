import { describe, expect, it } from 'vitest';
import { createAudioEngine, enableOnGesture, SCALE } from '../../../src/audio/engine.ts';

class FakeCtx {
  currentTime = 0;
  oscillators: { frequency: { value: number }; start: number }[] = [];
  destination = {};
  resumes = 0;
  suspends = 0;
  createOscillator() {
    const rec = { type: '', frequency: { value: 0 }, start: -1, connect() {}, stop() {} };
    this.oscillators.push(rec);
    return Object.assign(rec, {
      start: (t: number) => {
        rec.start = t;
      },
    });
  }
  createGain() {
    const p = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: p, connect() {} };
  }
  resume() {
    this.resumes += 1;
    return Promise.resolve();
  }
  suspend() {
    this.suspends += 1;
    return Promise.resolve();
  }
}

function setup() {
  const made: FakeCtx[] = [];
  const engine = createAudioEngine(
    () => {
      const c = new FakeCtx();
      made.push(c);
      return c as unknown as AudioContext;
    },
    () => ({ timbre: { wave: 'sine', attack: 0.01, decay: 0.3 }, note: 2 }),
  );
  return { made, engine };
}

describe('createAudioEngine', () => {
  it('makes no context while sound is off, and plays nothing', () => {
    const { made, engine } = setup();
    engine.play({ kind: 'pop' });
    engine.setEnabled(false);
    expect(made).toHaveLength(0);
  });

  it('plays a chirp from the creature note, one step per tone', () => {
    const { made, engine } = setup();
    engine.setEnabled(true);
    const c = made[0] as FakeCtx;
    engine.play({ kind: 'chirp', who: 'pim', mood: 'happy' });
    expect(c.oscillators.map((o) => o.frequency.value)).toEqual([SCALE[2], SCALE[4], SCALE[6]]);
    expect(c.oscillators[1]?.start).toBeGreaterThan(c.oscillators[0]?.start ?? 0);
  });

  it('keeps one context across mute and unmute, and plays nothing while muted', () => {
    const { made, engine } = setup();
    engine.setEnabled(true);
    engine.setEnabled(false);
    engine.play({ kind: 'sticker' });
    engine.setEnabled(true);
    expect(made).toHaveLength(1);
    expect(made[0]?.oscillators).toHaveLength(0);
    expect(made[0]?.suspends).toBe(1);
    expect(made[0]?.resumes).toBe(2);
  });
});

describe('enableOnGesture', () => {
  it('creates no context until the first gesture, then enables once', () => {
    const { made, engine } = setup();
    const target = new EventTarget();
    enableOnGesture(engine, target, () => true);
    expect(made).toHaveLength(0);
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('keydown'));
    expect(made).toHaveLength(1);
  });

  it('does nothing if sound was turned off before the gesture', () => {
    const { made, engine } = setup();
    const target = new EventTarget();
    enableOnGesture(engine, target, () => false);
    target.dispatchEvent(new Event('keydown'));
    expect(made).toHaveLength(0);
  });
});
