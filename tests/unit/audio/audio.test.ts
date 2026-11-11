import { describe, expect, it } from 'vitest';
import { createAudioEngine, enableOnGesture } from '../../../src/audio/engine.ts';
import { soundFor } from '../../../src/audio/event-sounds.ts';
import { pitchFor, scaleTones } from '../../../src/audio/scale.ts';
import type { Season } from '../../../src/sim/types.ts';

const seasons: Season[] = ['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'];

class FakeCtx {
  currentTime = 0;
  state = 'suspended';
  oscillators: { frequency: { value: number }; start: number }[] = [];
  filters: { type: string; frequency: { value: number } }[] = [];
  destination = {};
  resumes = 0;
  suspends = 0;
  createOscillator() {
    const o = {
      type: '',
      frequency: { value: 0 },
      start: -1,
      connect() {},
      stop() {},
    };
    const rec = {
      frequency: o.frequency,
      get start() {
        return o.start;
      },
    };
    this.oscillators.push(rec);
    return Object.assign(o, {
      start: (t: number) => {
        o.start = t;
      },
    });
  }
  createGain() {
    const p = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: p, connect() {} };
  }
  createBiquadFilter() {
    const f = { type: '', frequency: { value: 0 }, connect() {} };
    this.filters.push(f);
    return f;
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

const voice = { timbre: { wave: 'sine' as const, attack: 0.01, decay: 0.5 }, lineLength: 3 };
function setup() {
  const made: FakeCtx[] = [];
  const engine = createAudioEngine(
    () => {
      const c = new FakeCtx();
      made.push(c);
      return c as unknown as AudioContext;
    },
    { voice: () => voice, season: () => 'spring' },
  );
  return { made, engine };
}

describe('pitchFor', () => {
  it('returns only scale tones and never rises as the line grows', () => {
    for (const s of seasons) {
      const tones = scaleTones(s);
      let prev = Infinity;
      for (let len = 0; len <= 10; len += 0.25) {
        const f = pitchFor(len, s);
        expect(tones).toContain(f);
        expect(f).toBeLessThanOrEqual(prev);
        prev = f;
      }
      expect(pitchFor(-5, s)).toBe(tones[tones.length - 1]);
      expect(pitchFor(99, s)).toBe(tones[0]);
    }
  });
});

describe('pitchFor values', () => {
  it('gives the spring root for the shortest line and two octaves up for the longest', () => {
    expect(pitchFor(2, 'spring')).toBeCloseTo(261.63 * Math.pow(2, 21 / 12), 2);
    expect(pitchFor(5, 'spring')).toBeCloseTo(261.63, 2);
  });
});

describe('soundFor', () => {
  it('maps spec 11.5 events', () => {
    const bid = (reply: 'toward' | 'away' | 'against') =>
      soundFor({ t: 'bid', from: 'pim', to: 'krit', reply, seenAs: reply });
    expect(bid('toward')).toMatchObject({ kind: 'harmony', who: 'pim' });
    expect(bid('away')).toMatchObject({ kind: 'fade' });
    expect(bid('against')).toMatchObject({ kind: 'clash' });
    // Broken trust, forgiveness and warm cluster have no M1 sim source: null until M2 emits them.
    expect(soundFor({ t: 'opinion', holder: 'a', about: 'b', value: -0.8 })).toBeNull();
    expect(soundFor({ t: 'return', who: 'pim' })).toBeNull();
    expect(soundFor({ t: 'arrive', who: 'pim' })).toBeNull();
  });
});

describe('createAudioEngine', () => {
  it('makes no context while sound is off, and plays nothing', () => {
    const { made, engine } = setup();
    engine.play({ kind: 'fade', who: 'pim' });
    engine.setEnabled(false);
    expect(made).toHaveLength(0);
  });

  it('plays the welcome chord once, on the first unmute only', () => {
    const { made, engine } = setup();
    engine.setEnabled(true);
    expect(made).toHaveLength(1);
    expect(made[0]?.oscillators).toHaveLength(3);
    engine.setEnabled(false);
    engine.setEnabled(true);
    expect(made).toHaveLength(1);
    expect(made[0]?.oscillators).toHaveLength(3);
    expect(made[0]?.suspends).toBe(1);
    expect(made[0]?.resumes).toBe(2);
  });

  it('plays cues only while on, with the voice pitch and a muffling filter for fog', () => {
    const { made, engine } = setup();
    engine.setEnabled(true);
    const c = made[0] as FakeCtx;
    c.currentTime = 2;
    engine.play({ kind: 'harmony', who: 'pim', ratio: 1.5 });
    const [a, b] = c.oscillators.slice(3);
    expect(a?.start).toBe(2);
    expect(a?.frequency.value).toBe(pitchFor(3, 'spring'));
    expect(b?.frequency.value).toBeCloseTo(pitchFor(3, 'spring') * 1.5);
    const clear = c.filters[0]?.frequency.value as number;
    engine.setFog(1);
    expect(c.filters[0]?.frequency.value).toBeLessThan(clear);
    engine.setEnabled(false);
    engine.play({ kind: 'fade', who: 'pim' });
    expect(c.oscillators).toHaveLength(5);
  });
});

describe('enableOnGesture', () => {
  it('creates no context until the first gesture, then enables once', () => {
    const { made, engine } = setup();
    const target = new EventTarget();
    enableOnGesture(engine, target, () => true);
    expect(made).toHaveLength(0);
    target.dispatchEvent(new Event('pointerdown'));
    expect(made).toHaveLength(1);
    target.dispatchEvent(new Event('keydown'));
    expect(made).toHaveLength(1);
    expect(made[0]?.oscillators).toHaveLength(3);
  });

  it('does nothing if sound was turned off before the gesture', () => {
    const { made, engine } = setup();
    const target = new EventTarget();
    enableOnGesture(engine, target, () => false);
    target.dispatchEvent(new Event('keydown'));
    expect(made).toHaveLength(0);
  });
});
