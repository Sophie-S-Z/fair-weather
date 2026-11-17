import { schedule } from '../director.ts';
import {
  beforeWall,
  behindWall,
  CART_SECONDS,
  segmentDist,
  trackPaths,
  twinBoxes,
  WALL_HALF,
} from '../geometry.ts';
import { critter, isFree, near, newCritter, prop } from '../table.ts';
import type { Critter, Discovery, Prop, Table } from '../types.ts';
import { nameOf } from './game-theory.ts';
import { Script } from './script.ts';

const quillFor = (t: Table, skip: readonly Critter[]): Critter | undefined =>
  t.critters.find((c) => c.cast === 'quill' && isFree(c) && !skip.includes(c));

/** A creature goes into twin box A and also comes out of box B. Which one is it? (personal identity) */
export const identity: Discovery = {
  id: 'identity',
  detect(t) {
    const twins = prop(t, 'twins');
    const c = t.boxed ? critter(t, t.boxed) : undefined;
    if (!twins || !c || !isFree(c)) return null;
    t.boxed = null;
    const { a, b } = twinBoxes(twins);
    const copy: Critter = {
      ...newCritter(c.cast, b[0], b[1], `${c.id}+copy`),
      busy: true,
      mood: { ...c.mood },
    };
    const quill = quillFor(t, [c]);
    const sc = new Script()
      .do({ do: 'prop', kind: 'twins', patch: { since: t.time } })
      .wait(0.9)
      .do({ do: 'spawn', critter: copy })
      .wait(0.3)
      .do(
        { do: 'walk', who: c.id, x: a[0] + 20, y: a[1] + 80 },
        { do: 'walk', who: copy.id, x: b[0] - 20, y: b[1] + 80 },
      )
      .wait(1.2)
      .do(
        { do: 'face', who: c.id, to: copy.id },
        { do: 'face', who: copy.id, to: c.id },
        { do: 'say', who: c.id, icon: 'question' },
        { do: 'say', who: copy.id, icon: 'question' },
      )
      .wait(1.6)
      .do(
        { do: 'say', who: c.id, icon: 'storm' },
        { do: 'say', who: copy.id, icon: 'storm' },
        { do: 'feel', who: c.id, mood: { bristle: 1 }, chirp: 'angry' },
        { do: 'feel', who: copy.id, mood: { bristle: 1 } },
        { do: 'hop', who: c.id },
        { do: 'hop', who: copy.id },
      )
      .wait(1.6);
    if (quill) {
      sc.do({ do: 'walk', who: quill.id, x: (a[0] + b[0]) / 2, y: a[1] + 150 })
        .wait(1.8)
        .do({ do: 'say', who: quill.id, icon: 'question', for: 2 }, { do: 'look', who: quill.id, up: true })
        .wait(1.6);
    }
    sc.do(
      { do: 'feel', who: c.id, mood: { bristle: 0, softness: 1 }, chirp: 'happy' },
      { do: 'feel', who: copy.id, mood: { bristle: 0, softness: 1 } },
      { do: 'say', who: c.id, icon: 'heart' },
      { do: 'say', who: copy.id, icon: 'heart' },
      { do: 'walk', who: copy.id, x: (a[0] + b[0]) / 2 + 25, y: a[1] + 80 },
      { do: 'walk', who: c.id, x: (a[0] + b[0]) / 2 - 25, y: a[1] + 80 },
    )
      .wait(1.4)
      .do(
        { do: 'remove', who: copy.id },
        { do: 'hop', who: c.id },
        {
          do: 'line',
          text: `${nameOf(c)} came out twice. Both said they were the real one. They hugged, and there was one again.`,
        },
      );
    return sc.scene('identity', [c.id, copy.id, ...(quill ? [quill.id] : [])], ['identity'], 'twins');
  },
};

const onBranch = (p: Prop, c: Critter, branch: 'far' | 'near'): boolean => {
  const [x1, y1, x2, y2] = trackPaths(p)[branch];
  return segmentDist(c.x, c.y, x1, y1, x2, y2) < 36 && c.x > x1 + 40;
};

/** Creatures on both branches of the track, and a cart on its way. The lever is yours (trolley problem). */
export const lever: Discovery = {
  id: 'lever',
  detect(t) {
    const track = prop(t, 'track');
    if (!track || track.since >= 0) return null;
    const free = t.critters.filter(isFree);
    const far = free.filter((c) => onBranch(track, c, 'far'));
    const nearOnes = free.filter((c) => onBranch(track, c, 'near'));
    if (far.length === 0 || nearOnes.length === 0) return null;
    const riders = [...far, ...nearOnes];
    const quill = quillFor(t, riders);
    const sc = new Script()
      .do({ do: 'prop', kind: 'track', patch: { since: t.time } })
      .do(...riders.map((c) => ({ do: 'face' as const, who: c.id, to: track.x - 300 })))
      .do(...riders.map((c) => ({ do: 'say' as const, who: c.id, icon: 'bang' as const, for: 1.2 })));
    if (quill) {
      sc.do({ do: 'walk', who: quill.id, x: track.x - 80, y: track.y + 110 })
        .wait(1.2)
        .do({ do: 'say', who: quill.id, icon: 'question', for: 1.6 });
    }
    const leave = (c: Critter, side: number): { do: 'walk'; who: string; x: number; y: number } => ({
      do: 'walk',
      who: c.id,
      x: c.x,
      y: c.y + side * 90,
    });
    sc.wait(Math.max(0, CART_SECONDS * 0.45 - sc.at)).do({
      do: 'run',
      fn: (tt, s) => {
        const p = prop(tt, 'track');
        if (!p) return;
        const [hit, spared] = p.on ? [nearOnes, far] : [far, nearOnes];
        hit.forEach((c, i) => {
          schedule(tt, s, 0.1 * i, leave(c, p.on ? 1 : -1));
          schedule(tt, s, 0.1 * i, { do: 'say', who: c.id, icon: 'storm', for: 2.4 });
          schedule(tt, s, 0.1 * i, { do: 'feel', who: c.id, mood: { bristle: 1 }, chirp: 'angry' });
        });
        spared.forEach((c, i) => {
          schedule(tt, s, 0.5 + 0.1 * i, leave(c, p.on ? -1 : 1));
          schedule(tt, s, 0.5 + 0.1 * i, { do: 'say', who: c.id, icon: 'storm', for: 2.4 });
        });
        schedule(tt, s, 0, {
          do: 'line',
          text: p.on
            ? 'You pulled the lever. Everyone hops off before the toy cart comes, and they are all cross with you.'
            : 'You left the lever. Everyone hops off before the toy cart comes, and they are all cross with you.',
        });
      },
    });
    sc.wait(CART_SECONDS * 0.55 + 0.4).do({ do: 'prop', kind: 'track', patch: { since: -1 } });
    if (quill)
      sc.do(
        { do: 'face', who: quill.id, to: track.x },
        { do: 'say', who: quill.id, icon: 'question', for: 2 },
      );
    return sc.scene(
      'lever',
      [...riders, ...(quill ? [quill] : [])].map((c) => c.id),
      ['lever'],
      'track',
      2,
    );
  },
};

/** A fan in front of the lit wall cheers the shadows, then meets a shadow maker (Plato's cave). */
export const shadows: Discovery = {
  id: 'shadows',
  detect(t) {
    const lamp = prop(t, 'lamp');
    if (!lamp?.on) return null;
    const makers = t.critters.filter((c) => isFree(c) && behindWall(lamp, c.x, c.y)).slice(0, 3);
    const fan = near(t, lamp.x, lamp.y + 90, 220, (c) => isFree(c) && beforeWall(lamp, c.x, c.y))[0];
    if (makers.length < 2 || !fan) return null;
    const sc = new Script().do(
      { do: 'face', who: fan.id, to: lamp.x },
      { do: 'look', who: fan.id, up: true },
    );
    for (let k = 0; k < 3; k++) {
      sc.do(...makers.map((c) => ({ do: 'hop' as const, who: c.id })))
        .do(
          { do: 'say', who: fan.id, icon: k === 2 ? 'star' : 'heart', for: 0.9 },
          { do: 'feel', who: fan.id, mood: { softness: 1 }, chirp: 'happy' },
        )
        .wait(0.9);
    }
    const walker = makers[0] as Critter;
    const side = walker.x <= lamp.x ? -1 : 1;
    sc.do({ do: 'walk', who: walker.id, x: lamp.x + side * (WALL_HALF + 50), y: lamp.y - 30 })
      .wait(1.6)
      .do({ do: 'walk', who: walker.id, x: fan.x + side * 70, y: fan.y })
      .wait(1.8)
      .do(
        { do: 'look', who: fan.id, up: false },
        { do: 'face', who: fan.id, to: walker.id },
        { do: 'face', who: walker.id, to: fan.id },
        { do: 'say', who: walker.id, icon: 'heart' },
        { do: 'say', who: fan.id, icon: 'question' },
      )
      .wait(1.5)
      .do(
        { do: 'face', who: fan.id, to: lamp.x },
        { do: 'look', who: fan.id, up: true },
        { do: 'say', who: fan.id, icon: 'heart', for: 2 },
      )
      .wait(0.8)
      .do(
        { do: 'say', who: walker.id, icon: 'storm', for: 2 },
        { do: 'feel', who: walker.id, mood: { tightness: 0.8 }, chirp: 'sad' },
        {
          do: 'line',
          text: `${nameOf(fan)} meets the real ${nameOf(walker)}, then turns back to cheer the shadows.`,
        },
      );
    return sc.scene('shadows', [fan.id, ...makers.map((c) => c.id)], ['shadows'], 'lamp', 1.6);
  },
};
