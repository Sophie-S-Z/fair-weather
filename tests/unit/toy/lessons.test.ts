import { describe, expect, it } from 'vitest';
import stickers from '../../../content/toy/stickers.json';
import { DISCOVERIES } from '../../../src/toy/discoveries/index.ts';
import { LESSON_LOOPS, LOOP_MAX } from '../../../src/toy/lessons.ts';
import { DT, step } from '../../../src/toy/step.ts';
import { createTable } from '../../../src/toy/table.ts';
import { STICKER_IDS, type ToyEvent } from '../../../src/toy/types.ts';
import type { LoopSetup } from '../../../src/toy/lessons.ts';

/** Plays a loop the way the lesson page does and returns its scene ids and lines. */
function play(setup: LoopSetup): { scenes: string[]; lines: string[] } {
  const t = createTable({ seed: 1, ...setup, wander: false });
  const cues = [...(setup.cues ?? [])];
  const scenes: string[] = [];
  const events: ToyEvent[] = [];
  for (let k = 0; k * DT < LOOP_MAX; k++) {
    while (cues[0] && cues[0].at <= t.time) cues.shift()?.act(t);
    step(t, DISCOVERIES);
    if (t.scene && scenes.at(-1) !== t.scene.id) scenes.push(t.scene.id);
    events.push(...t.events.splice(0));
  }
  return { scenes, lines: events.flatMap((e) => (e.kind === 'line' ? [e.text] : [])) };
}

describe('lesson loops', () => {
  it('give every sticker a loop for each sentence or a plain sentence', () => {
    for (const s of stickers.stickers) {
      const loops = LESSON_LOOPS[s.id as (typeof STICKER_IDS)[number]];
      expect(loops).toHaveLength(s.lesson.length);
      expect(loops.some((l) => l !== null)).toBe(true);
      expect('knob' in s).toBe(loops.some((l) => (l?.variants.length ?? 0) > 1));
    }
    expect(stickers.stickers.map((s) => s.id).sort()).toEqual([...STICKER_IDS].sort());
  });

  for (const id of STICKER_IDS) {
    it(`act out ${id}`, () => {
      const out = LESSON_LOOPS[id]
        .flatMap((l) => l?.variants ?? [])
        .map((v) => ({ label: v.label, ...play(v.setup) }));
      const scenesWanted = id === 'bridge' ? 1 : out.length;
      expect(out.filter((o) => o.scenes.length > 0)).toHaveLength(scenesWanted);
      expect(out.every((o) => o.lines.length <= 1)).toBe(true);
    });
  }
});

describe('lesson outcomes match their sentences', () => {
  const lineOf = (id: (typeof STICKER_IDS)[number], loop: number, variant = 0): string =>
    play(LESSON_LOOPS[id][loop]?.variants[variant]?.setup ?? { cast: [] }).lines.join(' ');
  it('shows a share, a grab, and a break in the standoff', () => {
    expect(lineOf('standoff', 0)).toContain('both share');
    expect(lineOf('standoff', 1)).toContain('grabs and gets the whole cookie');
    expect(lineOf('standoff', 2)).toContain('both grab');
  });
  it('shows Echo sharing with a sharer and feuding after a slip', () => {
    expect(lineOf('copycat', 0)).toContain('both share');
    expect(lineOf('copycat', 1)).toContain('both grab');
    expect(lineOf('copycat', 2, 2)).toContain('both grab');
  });
  it('ends every whisper as a monster', () => {
    expect(lineOf('telephone', 0, 0)).toContain('monster');
  });
});
