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
  /** The one owner of the current tool: keyboard, pointer, and HUD all read it here. */
  tool: () => Verb | null;
  setTool: (v: Verb) => void;
  /** The reply Enter sends with the respond tool; G, H, and R set it. Owned by the caller, so the HUD shows it. */
  reply: () => BidReply;
  setReply: (r: BidReply) => void;
  act: (v: VerbInput) => void;
  togglePause: () => void;
  /** The one owner of the picked creature: Tab, a click, and the HUD all read and write it here. */
  picked: () => string | null;
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
/** While the respond tool is active: G glow back, H hold still, R rumble. */
const REPLY_KEYS: Record<string, BidReply> = { g: 'toward', h: 'away', r: 'against' };

export function createKeyboard(target: EventTarget, ctx: InputContext): () => void {
  const activeTool = (): Verb | null => {
    const tools = keyboardTools(ctx.tools());
    const t = ctx.tool();
    return t !== null && tools.includes(t) ? t : (tools[0] ?? null);
  };

  const onKey = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (k.ctrlKey || k.metaKey || k.altKey) return;
    const t = k.target as { tagName?: string; isContentEditable?: boolean } | null;
    const tag = t?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;

    const key = k.key;
    // Native activation of buttons and links must fire once, not also act here.
    if ((key === 'Enter' || key === ' ') && (tag === 'BUTTON' || tag === 'A')) return;
    if (key >= '1' && key <= '3') {
      const t2 = keyboardTools(ctx.tools())[Number(key) - 1];
      if (t2 !== undefined) ctx.setTool(t2);
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
      const picked = ctx.picked();
      const i = picked === null ? -1 : ids.indexOf(picked);
      const n = ids.length;
      const next = k.shiftKey ? (i <= 0 ? n - 1 : i - 1) : (i + 1) % n;
      ctx.select(ids[next] as string);
      k.preventDefault();
    } else if (key === 'Enter') {
      const v = activeTool();
      const picked = ctx.picked();
      if (v === 'wake' && picked !== null) ctx.act({ verb: 'wake', who: picked });
      else if (v === 'respond') ctx.act({ verb: 'respond', reply: ctx.reply() });
      else if (v === 'place') ctx.act({ verb: 'place', ...snapToBench(ctx.cursor(), ctx.benchSpots()) });
    } else if (key === ' ') {
      ctx.togglePause();
      k.preventDefault();
    } else if (key.toLowerCase() in REPLY_KEYS && activeTool() === 'respond') {
      ctx.setReply(REPLY_KEYS[key.toLowerCase()] as BidReply);
    }
  };

  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('keydown', onKey);
  };
}
