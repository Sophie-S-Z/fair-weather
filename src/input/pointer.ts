// Pointer clicks take the same act/select path as the keyboard. `pick` is render's hit test.
import type { InputContext } from './keyboard.ts';

export type PickFn = (x: number, y: number) => { creature: string | null };

export function createPointer(
  target: EventTarget,
  pick: PickFn,
  ctx: Pick<InputContext, 'select' | 'act'> & { tool: () => string | null },
): () => void {
  const onDown = (e: Event): void => {
    const p = e as PointerEvent;
    if (p.button > 0) return;
    const { creature } = pick(p.clientX, p.clientY);
    ctx.select(creature);
    if (creature !== null && ctx.tool() === 'wake') ctx.act({ verb: 'wake', who: creature });
  };
  target.addEventListener('pointerdown', onDown);
  return () => {
    target.removeEventListener('pointerdown', onDown);
  };
}
