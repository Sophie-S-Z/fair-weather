// Keyboard play (spec 12.5). The Game screen supplies the InputContext.
import type { BidReply } from '../sim/types.ts';
import type { Verb, VerbInput } from '../story/verbs.ts';
import { keyboardTools, snapToBench, type BenchSpot, type Point } from './verbs.ts';

export type InputContext = {
  /** Unlocked tools, up to 3. */
  tools: () => readonly Verb[];
  /** Creatures in id order. `away` ones are skipped by Tab. */
  creatures: () => readonly { id: string; state: string }[];
  benchSpots: () => readonly BenchSpot[];
  cursor: () => Point;
  act: (v: VerbInput) => void;
  togglePause: () => void;
  select: (id: string | null) => void;
  moveCursor: (p: Point) => void;
};

export const CURSOR_STEP = 20;
const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -CURSOR_STEP, y: 0 },
  ArrowRight: { x: CURSOR_STEP, y: 0 },
  ArrowUp: { x: 0, y: -CURSOR_STEP },
  ArrowDown: { x: 0, y: CURSOR_STEP },
};
/** While the respond tool is active: G glow back, H hold still, R rumble. Default glow back. */
const REPLY_KEYS: Record<string, BidReply> = { g: 'toward', h: 'away', r: 'against' };

export function createKeyboard(target: EventTarget, ctx: InputContext): () => void {
  let tool: Verb | null = null;
  let reply: BidReply = 'toward';
  let picked: string | null = null;

  const activeTool = (): Verb | null => {
    const tools = keyboardTools(ctx.tools());
    return tool !== null && tools.includes(tool) ? tool : (tools[0] ?? null);
  };

  const onKey = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (k.ctrlKey || k.metaKey || k.altKey) return;
    const t = k.target as { tagName?: string; isContentEditable?: boolean } | null;
    const tag = t?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;

    const key = k.key;
    if (key >= '1' && key <= '3') {
      const t2 = keyboardTools(ctx.tools())[Number(key) - 1];
      if (t2 !== undefined) tool = t2;
    } else if (key in ARROWS) {
      const d = ARROWS[key] as Point;
      const c = ctx.cursor();
      ctx.moveCursor({ x: c.x + d.x, y: c.y + d.y });
      k.preventDefault();
    } else if (key === 'Tab') {
      const ids = ctx
        .creatures()
        .filter((c) => c.state !== 'away')
        .map((c) => c.id);
      if (ids.length === 0) return;
      const i = picked === null ? -1 : ids.indexOf(picked);
      const n = ids.length;
      const next = k.shiftKey ? (i <= 0 ? n - 1 : i - 1) : (i + 1) % n;
      picked = ids[next] as string;
      ctx.select(picked);
      k.preventDefault();
    } else if (key === 'Enter') {
      const v = activeTool();
      if (v === 'wake' && picked !== null) ctx.act({ verb: 'wake', who: picked });
      else if (v === 'respond') ctx.act({ verb: 'respond', reply });
      else if (v === 'place') ctx.act({ verb: 'place', ...snapToBench(ctx.cursor(), ctx.benchSpots()) });
    } else if (key === ' ') {
      ctx.togglePause();
      k.preventDefault();
    } else if (key.toLowerCase() in REPLY_KEYS && activeTool() === 'respond') {
      reply = REPLY_KEYS[key.toLowerCase()] as BidReply;
    }
  };

  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('keydown', onKey);
  };
}
