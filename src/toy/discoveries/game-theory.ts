import { CAST } from '../cast.ts';
import { schedule } from '../director.ts';
import { component, critter, near, pairKey, prop } from '../table.ts';
import type { Critter, Discovery, Move, RunningScene, Table } from '../types.ts';
import { Script } from './script.ts';

export const nameOf = (c: Critter): string => CAST[c.cast].name;

/** Cookie rounds with one partner before Echo's sticker. */
export const COPYCAT_ROUNDS = 3;

/**
 * A creature's cookie move toward `other`. A poke since the scene began makes it grab by accident.
 * Echo copies the other's last move toward it (sharing first). Snail shares until wronged, then
 * grabs forever. Everyone else rolls their share chance.
 */
export function cookieMove(t: Table, me: Critter, other: Critter, since: number): Move {
  if (me.pokedAt >= since) return 'grab';
  if (me.cast === 'echo') return t.memory[`${other.id}>${me.id}`] ?? 'share';
  if (me.cast === 'snail' && t.grudges.includes(`${me.id}>${other.id}`)) return 'grab';
  return t.rng.next() < CAST[me.cast].share ? 'share' : 'grab';
}

function settleCookie(t: Table, s: RunningScene, a: Critter, b: Critter): void {
  const ma = cookieMove(t, a, b, s.start);
  const mb = cookieMove(t, b, a, s.start);
  t.memory[`${a.id}>${b.id}`] = ma;
  t.memory[`${b.id}>${a.id}`] = mb;
  for (const [me, other, theirs] of [
    [a, b, mb],
    [b, a, ma],
  ] as const) {
    if (me.cast === 'snail' && theirs === 'grab' && !t.grudges.includes(`${me.id}>${other.id}`)) {
      t.grudges.push(`${me.id}>${other.id}`);
    }
  }
  const key = pairKey(a.id, b.id);
  const rounds = (t.rounds[key] ?? 0) + 1;
  t.rounds[key] = rounds;
  const echoGame = (a.cast === 'echo' || b.cast === 'echo') && rounds >= COPYCAT_ROUNDS;
  if ((ma === 'grab' && mb === 'grab') || rounds >= COPYCAT_ROUNDS) s.unlock.push('standoff');
  if (echoGame) s.unlock.push('copycat');

  const [na, nb] = [nameOf(a), nameOf(b)];
  if (ma === 'share' && mb === 'share') {
    schedule(t, s, 0, { do: 'prop', kind: 'cookie', patch: { count: 2 } });
    for (const c of [a, b]) {
      schedule(t, s, 0.3, { do: 'say', who: c.id, icon: 'heart' });
      schedule(t, s, 0.3, { do: 'feel', who: c.id, mood: { softness: 1, color: 0.7 }, chirp: 'happy' });
      schedule(t, s, 0.4, { do: 'hop', who: c.id });
    }
    schedule(t, s, 0, { do: 'line', text: `${na} and ${nb} both share. Half a cookie each.` });
  } else if (ma === 'grab' && mb === 'grab') {
    schedule(t, s, 0, { do: 'prop', kind: 'cookie', patch: { count: 0 } });
    for (const c of [a, b]) {
      schedule(t, s, 0.1, { do: 'say', who: c.id, icon: 'crumbs', for: 2.2 });
      schedule(t, s, 0.6, { do: 'feel', who: c.id, mood: { tightness: 0.8, softness: 0 }, chirp: 'sad' });
    }
    schedule(t, s, 0, { do: 'line', text: `${na} and ${nb} both grab. The cookie breaks to crumbs.` });
  } else {
    const [taker, loser] = ma === 'grab' ? [a, b] : [b, a];
    const away = taker.x + (taker.x < loser.x ? -70 : 70);
    schedule(t, s, 0, { do: 'walk', who: taker.id, x: away, y: taker.y });
    schedule(t, s, 0, { do: 'prop', kind: 'cookie', patch: { count: -1 } });
    schedule(t, s, 0, { do: 'say', who: taker.id, icon: 'cookie', for: 2.2 });
    schedule(t, s, 0.1, { do: 'feel', who: taker.id, mood: { softness: 1 }, chirp: 'happy' });
    schedule(t, s, 0.3, { do: 'say', who: loser.id, icon: 'storm', for: 2.2 });
    schedule(t, s, 0.3, { do: 'feel', who: loser.id, mood: { bristle: 1 }, chirp: 'angry' });
    schedule(t, s, 0, {
      do: 'line',
      text: `${nameOf(taker)} grabs and gets the whole cookie. ${nameOf(loser)} shared and gets nothing.`,
    });
  }
  schedule(t, s, 2.6, { do: 'take', kind: 'cookie' });
}

/** Two creatures near a cookie each share or grab (prisoner's dilemma; Echo's game is tit for tat). */
export const standoff: Discovery = {
  id: 'standoff',
  detect(t) {
    const cookie = prop(t, 'cookie');
    if (!cookie || cookie.count !== 1) return null;
    const [a, b] = near(t, cookie.x, cookie.y, 200);
    if (!a || !b) return null;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const ids = [left.id, right.id];
    return new Script()
      .do(
        { do: 'walk', who: left.id, x: cookie.x - 60, y: cookie.y },
        { do: 'walk', who: right.id, x: cookie.x + 60, y: cookie.y },
      )
      .wait(1.3)
      .do(...ids.map((who) => ({ do: 'face' as const, who, to: cookie.x })))
      .do(...ids.map((who) => ({ do: 'say' as const, who, icon: 'cookie' as const, for: 1.2 })))
      .wait(1.4)
      .do(...ids.map((who) => ({ do: 'say' as const, who, icon: 'question' as const, for: 0.9 })))
      .wait(1)
      .do({
        do: 'run',
        fn: (tt, s) => {
          const ca = critter(tt, left.id);
          const cb = critter(tt, right.id);
          if (ca && cb) settleCookie(tt, s, ca, cb);
        },
      })
      .scene('standoff', ids, [], 'cookie', 3.2);
  },
};

/** Four or more creatures at the berry bush (tragedy of the commons). Tied eaters take turns. */
export const commons: Discovery = {
  id: 'commons',
  detect(t) {
    const bush = prop(t, 'bush');
    if (!bush?.on || bush.count < 4) return null;
    const eaters = near(t, bush.x, bush.y, 210).slice(0, 5);
    if (eaters.length < 4) return null;
    const first = eaters[0] as Critter;
    const group = component(t, first.id);
    const friends = eaters.every((c) => group.has(c.id));
    const sc = new Script();
    eaters.forEach((c, i) => {
      const angle = Math.PI * (0.15 + (0.7 * i) / (eaters.length - 1));
      sc.do({
        do: 'walk',
        who: c.id,
        x: bush.x - Math.cos(angle) * 120,
        y: bush.y + Math.sin(angle) * 55 + 10,
      });
    });
    sc.wait(1.6).do(...eaters.map((c) => ({ do: 'face' as const, who: c.id, to: bush.x })));
    let berries = bush.count;
    if (friends) {
      for (const c of eaters) {
        if (berries <= 2) break;
        berries -= 1;
        sc.wait(0.7).do(
          { do: 'say', who: c.id, icon: 'berry', for: 1 },
          { do: 'prop', kind: 'bush', patch: { count: berries } },
          { do: 'hop', who: c.id },
        );
      }
      sc.wait(0.8).do(
        ...eaters.map((c) => ({ do: 'say' as const, who: c.id, icon: 'heart' as const })),
        ...eaters.map((c) => ({ do: 'feel' as const, who: c.id, mood: { softness: 1 } })),
        { do: 'line', text: 'The friends take turns. The bush keeps some berries and grows back.' },
      );
    } else {
      for (let round = 0; berries > 0; round++) {
        for (const c of eaters) {
          if (berries <= 0) break;
          const bite = c.cast === 'frog' ? Math.min(2, berries) : 1;
          berries -= bite;
          sc.wait(0.35).do(
            { do: 'say', who: c.id, icon: 'berry', n: bite, for: 0.8 },
            { do: 'prop', kind: 'bush', patch: { count: berries } },
          );
        }
        if (round > 6) break;
      }
      sc.wait(0.5)
        .do({ do: 'prop', kind: 'bush', patch: { on: false, count: 0, since: t.time + sc.at } })
        .wait(0.4)
        .do(
          ...eaters.map((c) => ({ do: 'say' as const, who: c.id, icon: 'question' as const, for: 2 })),
          ...eaters.map((c) => ({
            do: 'feel' as const,
            who: c.id,
            mood: { tightness: 0.7 },
            chirp: 'sad' as const,
          })),
          { do: 'line', text: 'Everyone takes just one more. The bush is bare and wilts.' },
        );
    }
    return sc.scene(
      'commons',
      eaters.map((c) => c.id),
      ['commons'],
      'bush',
      2,
    );
  },
};
