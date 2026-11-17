import { DOUBLE_POKE } from '../commands.ts';
import { component, critter, isFree, longestPathFrom, neighbors } from '../table.ts';
import type { Critter, Discovery, Icon } from '../types.ts';
import { nameOf } from './game-theory.ts';
import { Script } from './script.ts';

/** What the whisper turns into at each step along the chain. */
const WHISPER: readonly Icon[] = ['cookie', 'crown', 'star', 'storm', 'monster', 'monster'];
/** The shortest chain (in creatures) that makes a game of telephone. */
export const CHAIN = 4;

/** Kite, poked twice fast, whispers down a chain of ties, and the message changes (rumor spread). */
export const telephone: Discovery = {
  id: 'telephone',
  detect(t) {
    const kite = t.critters.find((c) => c.cast === 'kite');
    if (!kite || kite.pokes < 2 || t.time - kite.pokedAt > DOUBLE_POKE || !isFree(kite)) return null;
    kite.pokes = 0;
    const path = longestPathFrom(t, kite.id, WHISPER.length)
      .map((id) => critter(t, id))
      .filter((c): c is Critter => c !== undefined && isFree(c));
    if (path.length < CHAIN) return null;
    const sc = new Script();
    path.forEach((c, i) => {
      const prev = path[i - 1];
      if (prev) sc.do({ do: 'face', who: c.id, to: prev.id });
      sc.do(
        { do: 'say', who: c.id, icon: WHISPER[i] ?? 'monster', for: 1.6 },
        { do: 'hop', who: c.id },
        { do: 'feel', who: c.id, mood: {}, chirp: i === 0 ? 'happy' : 'surprised' },
      );
      const next = path[i + 1];
      if (next) sc.do({ do: 'face', who: c.id, to: next.id });
      sc.wait(1.1);
    });
    const last = path[path.length - 1] as Critter;
    sc.do(
      { do: 'say', who: last.id, icon: 'bang', for: 1.4 },
      { do: 'feel', who: last.id, mood: { bristle: 1, tightness: 0.6 }, chirp: 'angry' },
      { do: 'walk', who: last.id, x: last.x + (last.x > kite.x ? 160 : -160), y: last.y + 40 },
    )
      .wait(1.2)
      .do(
        { do: 'say', who: kite.id, icon: 'question', for: 2 },
        {
          do: 'line',
          text: `${nameOf(kite)} whispered "cookie". After ${String(path.length - 1)} steps, ${nameOf(last)} heard "monster".`,
        },
      );
    return sc.scene(
      'telephone',
      path.map((c) => c.id),
      ['telephone'],
      null,
      1.4,
    );
  },
};

/** The only tie between two groups of three or more is snipped, and the groups drift (weak ties). */
export const bridge: Discovery = {
  id: 'bridge',
  detect(t) {
    const snip = t.lastSnip;
    if (!snip) return null;
    t.lastSnip = null;
    if (t.time - snip.time > 1 || snip.sizes[0] < 3 || snip.sizes[1] < 3) return null;
    const side = (id: string): Critter[] =>
      [...component(t, id)]
        .map((s) => critter(t, s))
        .filter((c): c is Critter => c !== undefined && isFree(c));
    const a = side(snip.a);
    const b = side(snip.b);
    const mid = (g: Critter[]): number => g.reduce((s, c) => s + c.x, 0) / g.length;
    const away = mid(a) <= mid(b) ? -1 : 1;
    const sc = new Script();
    for (const [group, dir, other] of [
      [a, away, b],
      [b, -away, a],
    ] as const) {
      const target = other[0];
      sc.do(...group.map((c) => ({ do: 'face' as const, who: c.id, to: target ? target.id : c.x })));
      sc.do(...group.map((c) => ({ do: 'say' as const, who: c.id, icon: 'question' as const, for: 1.4 })));
      sc.do(...group.map((c) => ({ do: 'walk' as const, who: c.id, x: c.x + dir * 120, y: c.y })));
    }
    sc.wait(2.2).do(
      ...[...a, ...b].map((c) => ({ do: 'say' as const, who: c.id, icon: 'zzz' as const, for: 2 })),
      ...[...a, ...b].map((c) => ({ do: 'feel' as const, who: c.id, mood: { softness: 0, tightness: 0.3 } })),
      { do: 'line', text: 'One snip, and two groups stop hearing any news from each other.' },
    );
    return sc.scene(
      'bridge',
      [...a, ...b].map((c) => c.id),
      ['bridge'],
      null,
      2,
    );
  },
};

/** The most ties a creature can have and still count as lonely. */
const LONELY = 1;
/** The fewest ties that make a friend popular. */
export const POPULAR = 4;

/** A lonely creature, poked, counts its one friend's friends (friendship paradox). */
export const paradox: Discovery = {
  id: 'paradox',
  detect(t) {
    const poked = t.critters
      .filter((c) => isFree(c) && t.time - c.pokedAt < 0.4 && neighbors(t, c.id).length === LONELY)
      .sort((a, b) => b.pokedAt - a.pokedAt)[0];
    if (!poked) return null;
    const friend = critter(t, neighbors(t, poked.id)[0] ?? '');
    if (!friend || !isFree(friend)) return null;
    const many = neighbors(t, friend.id).length;
    if (many < POPULAR) return null;
    return new Script()
      .do(
        { do: 'face', who: poked.id, to: friend.id },
        { do: 'say', who: poked.id, icon: 'count', n: LONELY, for: 2.6 },
      )
      .wait(0.9)
      .do(
        { do: 'say', who: friend.id, icon: 'count', n: many, for: 2.6 },
        { do: 'hop', who: friend.id },
        { do: 'feel', who: friend.id, mood: { softness: 1 }, chirp: 'happy' },
      )
      .wait(1.6)
      .do(
        { do: 'feel', who: poked.id, mood: { tightness: 0.9, softness: 0 }, chirp: 'sad' },
        { do: 'say', who: poked.id, icon: 'question', for: 2 },
        {
          do: 'line',
          text: `${nameOf(poked)} has 1 friend. That friend, ${nameOf(friend)}, has ${String(many)}.`,
        },
      )
      .scene('paradox', [poked.id, friend.id], ['paradox'], null, 2);
  },
};
