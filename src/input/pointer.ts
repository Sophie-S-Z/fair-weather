// Pointer clicks take the same act/select path as the keyboard. `pick` is render's hit test.
import type { InputContext } from './keyboard.ts';
import { snapToBench, type Point } from './verbs.ts';

export type PickFn = (x: number, y: number) => { creature: string | null };

export function createPointer(
  target: EventTarget,
  pick: PickFn,
  /** Screen (client) point to scene point, supplied by the caller. */
  toScene: (x: number, y: number) => Point,
  ctx: Pick<InputContext, 'select' | 'act' | 'tool' | 'benchSpots'>,
): () => void {
  const onDown = (e: Event): void => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    const tool = ctx.tool();
    if (tool === 'place') {
      ctx.act({ verb: 'place', ...snapToBench(toScene(p.clientX, p.clientY), ctx.benchSpots()) });
      return;
    }
    const { creature } = pick(p.clientX, p.clientY);
    ctx.select(creature);
    if (creature !== null && tool === 'wake') ctx.act({ verb: 'wake', who: creature });
  };
  target.addEventListener('pointerdown', onDown);
  return () => {
    target.removeEventListener('pointerdown', onDown);
  };
}
