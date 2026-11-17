import { CAST } from '../cast.ts';
import { dist } from '../geometry.ts';
import { isFree, near, prop } from '../table.ts';
import type { Critter, Discovery } from '../types.ts';
import { nameOf } from './game-theory.ts';
import { Script } from './script.ts';

/** Three creatures at the signpost stare where it points, and the crowd grows (conformity). */
export const lookup: Discovery = {
  id: 'lookup',
  detect(t) {
    const sign = prop(t, 'signpost');
    if (!sign) return null;
    const starters = near(t, sign.x, sign.y, 170).slice(0, 3);
    if (starters.length < 3) return null;
    const joiners = t.critters
      .filter((c) => isFree(c) && !starters.includes(c))
      .sort(
        (a, b) =>
          Number(b.cast === 'tove') - Number(a.cast === 'tove') ||
          dist(a.x, a.y, sign.x, sign.y) - dist(b.x, b.y, sign.x, sign.y),
      )
      .slice(0, 4);
    const sc = new Script();
    for (const c of starters) {
      sc.do({ do: 'face', who: c.id, to: sign.x + 400 }, { do: 'look', who: c.id, up: true }).wait(0.5);
      sc.do({ do: 'say', who: c.id, icon: 'eye', for: 6 });
    }
    sc.wait(1);
    joiners.forEach((c, i) => {
      sc.do({ do: 'walk', who: c.id, x: sign.x - 40 - i * 55, y: sign.y + 70 + (i % 2) * 50 });
      sc.wait(1.1).do(
        { do: 'face', who: c.id, to: sign.x + 400 },
        { do: 'look', who: c.id, up: true },
        { do: 'say', who: c.id, icon: 'eye', for: 4 },
        { do: 'feel', who: c.id, mood: { tightness: 0.3 }, chirp: 'surprised' },
      );
    });
    const all = [...starters, ...joiners];
    sc.wait(1.6).do({
      do: 'line',
      text: `${String(all.length)} creatures stare at the sky where the sign points. Nothing is there.`,
    });
    const quill = all.find((c) => c.cast === 'quill');
    if (quill)
      sc.do({ do: 'look', who: quill.id, up: false }, { do: 'say', who: quill.id, icon: 'question', for: 2 });
    return sc.wait(1.6).scene(
      'lookup',
      all.map((c) => c.id),
      ['lookup'],
      'signpost',
    );
  },
};

/** A creature stuck in the puddle with onlookers. One helps at once; a crowd waits (bystander effect). */
export const bystander: Discovery = {
  id: 'bystander',
  detect(t) {
    const puddle = prop(t, 'puddle');
    const stuck = t.critters.find((c) => c.stuck && !c.busy && !c.held);
    if (!puddle || !stuck) return null;
    const lookers = near(t, stuck.x, stuck.y, 320).slice(0, 5);
    if (lookers.length === 0) return null;
    const sc = new Script().do({ do: 'say', who: stuck.id, icon: 'help', for: 1.4 });
    sc.do(...lookers.map((c) => ({ do: 'face' as const, who: c.id, to: stuck.id })));
    const helper = lookers[0] as Critter;
    if (lookers.length === 1) {
      sc.wait(0.6)
        .do({ do: 'walk', who: helper.id, x: stuck.x + (helper.x < stuck.x ? -55 : 55), y: stuck.y })
        .wait(1.4)
        .do({ do: 'free', who: stuck.id }, { do: 'hop', who: stuck.id })
        .do(
          { do: 'say', who: stuck.id, icon: 'heart' },
          { do: 'say', who: helper.id, icon: 'heart' },
          { do: 'feel', who: stuck.id, mood: { softness: 1, tightness: 0 }, chirp: 'happy' },
          {
            do: 'line',
            text: `Only ${nameOf(helper)} saw ${nameOf(stuck)}, so ${nameOf(helper)} helped at once.`,
          },
        );
      return sc.scene('bystander', [stuck.id, helper.id], [], 'puddle');
    }
    sc.wait(0.8).do(
      ...lookers.map((c) => ({ do: 'say' as const, who: c.id, icon: 'eye' as const, for: 1.2 })),
    );
    lookers.forEach((c, i) => {
      const other = lookers[(i + 1) % lookers.length] as Critter;
      sc.wait(0.4).do(
        { do: 'face', who: c.id, to: other.id },
        { do: 'say', who: c.id, icon: 'question', for: 1.2 },
      );
    });
    sc.wait(0.6).do(
      { do: 'say', who: stuck.id, icon: 'help', for: 1.4 },
      { do: 'feel', who: stuck.id, mood: {}, chirp: 'sad' },
    );
    const sleeper = lookers.find((c) => c.cast === 'moss') ?? lookers[lookers.length - 1];
    if (sleeper) sc.wait(1).do({ do: 'say', who: sleeper.id, icon: 'zzz', for: 2.4 });
    sc.wait(1.2).do(
      { do: 'say', who: stuck.id, icon: 'help', for: 2 },
      {
        do: 'line',
        text: `${String(lookers.length)} creatures saw ${nameOf(stuck)} stuck. Each one waited for someone else.`,
      },
    );
    sc.wait(2.2).do(
      { do: 'free', who: stuck.id },
      { do: 'walk', who: stuck.id, x: stuck.x, y: stuck.y + 90 },
      { do: 'say', who: stuck.id, icon: 'storm', for: 2 },
      { do: 'feel', who: stuck.id, mood: { bristle: 1 }, chirp: 'angry' },
    );
    return sc.scene('bystander', [stuck.id, ...lookers.map((c) => c.id)], ['bystander'], 'puddle', 1.6);
  },
};

/** Bell, smudged, sees itself in the mirror and panics. Nobody else noticed (spotlight effect). */
export const spotlight: Discovery = {
  id: 'spotlight',
  detect(t) {
    const mirror = prop(t, 'mirror');
    const bell = t.critters.find((c) => c.cast === 'bell');
    if (!mirror || !bell?.smudge || !isFree(bell) || dist(bell.x, bell.y, mirror.x, mirror.y) > 130)
      return null;
    const others = near(t, bell.x, bell.y, 900, (c) => isFree(c) && c !== bell).slice(0, 3);
    if (others.length < 2) return null;
    const sc = new Script()
      .do({ do: 'walk', who: bell.id, x: mirror.x + 55, y: mirror.y + 6 })
      .wait(1)
      .do({ do: 'face', who: bell.id, to: mirror.x })
      .wait(0.5)
      .do(
        { do: 'say', who: bell.id, icon: 'bang', for: 1 },
        { do: 'feel', who: bell.id, mood: { tightness: 1, color: 1 }, chirp: 'surprised' },
        { do: 'hop', who: bell.id },
      )
      .wait(1.2);
    for (const o of others) {
      sc.do({ do: 'walk', who: bell.id, x: o.x + (o.x < bell.x ? 60 : -60), y: o.y })
        .wait(1.3)
        .do({ do: 'face', who: bell.id, to: o.id }, { do: 'say', who: bell.id, icon: 'question', for: 1 })
        .wait(0.6)
        .do({
          do: 'say',
          who: o.id,
          icon: CAST[o.cast].idle === 'question' ? 'cookie' : CAST[o.cast].idle,
          for: 1.2,
        })
        .wait(0.9);
    }
    sc.do({ do: 'walk', who: bell.id, x: mirror.x + 55, y: mirror.y + 6 })
      .wait(1.4)
      .do(
        { do: 'face', who: bell.id, to: mirror.x },
        { do: 'clean', who: bell.id },
        { do: 'feel', who: bell.id, mood: { tightness: 0, softness: 1, color: 0.2 }, chirp: 'happy' },
        { do: 'say', who: bell.id, icon: 'star' },
        { do: 'line', text: 'Bell panics about the smudge. Nobody else noticed it at all.' },
      );
    return sc.scene('spotlight', [bell.id, ...others.map((c) => c.id)], ['spotlight'], 'mirror');
  },
};
