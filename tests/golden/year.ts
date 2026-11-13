// The year run (ADR 0012 item 1): the chapters from ch3 on, one after another, headless, each
// with its scripted player, the flags the one before wrote, and the carry main.ts would give it.
import flagsJson from '../../content/flags.json';
import scenarioJson from '../../content/scenarios/m0.json';
import type { Scenario } from '../../src/sim/types.ts';
import { carryFrom, restoreDials } from '../../src/story/carry.ts';
import type { Carry } from '../../src/story/carry.ts';
import type { Flags } from '../../src/story/flags.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { chosenOverrides } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import type { Chapter } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import type { HeadlessResult, ScriptedPlayer } from './run-chapter.ts';

export const CHAPTER_ORDER = [
  'ch0',
  'ch1',
  'ch2',
  'ch3',
  'i3',
  'ch4',
  'i4',
  'ch5',
  'i5',
  'ch6',
  'ch7',
  'i7',
  'ch8',
  'i8',
  'ch9',
  'ch10',
] as const;

const files = import.meta.glob<unknown>('../../content/chapters/*.json', { eager: true, import: 'default' });
const CHAPTERS = new Map<string, Chapter>(
  Object.values(files).map((json) => {
    const c = ChapterSchema.parse(json);
    return [c.id, c];
  }),
);

/** Plays ch3 to `upTo`, both included, from the default flags; `carries` holds each carried chapter's carry. */
export async function runYear(
  seed: number,
  upTo: string,
): Promise<{ results: Record<string, HeadlessResult>; carries: Record<string, Carry> }> {
  const from = CHAPTER_ORDER.indexOf('ch3');
  const to = CHAPTER_ORDER.findIndex((id) => id === upTo);
  if (to < from) throw new Error(`runYear plays from ch3 on, not to ${upTo}`);
  const results: Record<string, HeadlessResult> = {};
  const carries: Record<string, Carry> = {};
  let flags = parseFlags(flagsJson);
  let before: { result: HeadlessResult; carry: Carry | undefined; config: Chapter; flags: Flags } | undefined;
  for (const id of CHAPTER_ORDER.slice(from, to + 1)) {
    const config = CHAPTERS.get(id);
    const player = (PLAYERS as Record<string, (() => ScriptedPlayer) | undefined>)[id];
    if (!config || !player) throw new Error(`chapter ${id} has no config or no scripted player`);
    // As main.ts: the carry from the last chapter's end, with its dial overrides put back.
    const carry = config.carry && before ? carryFrom(before.result.last, before.result.diaries) : undefined;
    if (carry && before)
      restoreDials(
        carry,
        before.carry,
        scenarioJson as Scenario,
        chosenOverrides(before.config, before.flags),
      );
    if (carry) carries[id] = carry;
    const result = (results[id] = await runChapterHeadless(config, seed, player(), flags, undefined, carry));
    before = { result, carry, config, flags };
    flags = result.flags;
  }
  return { results, carries };
}
