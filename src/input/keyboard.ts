// Keyboard play (spec 12.5). The Game screen supplies the InputContext.
import type { ViewName } from './zoom.ts';
import type { BidReply, GiftMove, HeroKind, Rect, Structure } from '../sim/types.ts';
import { tuning } from '../story/tuning.ts';
import type { Verb, VerbInput, WorldVerb } from '../story/verbs.ts';
import { keyboardTools, snapToBench, snapToWater, type BenchSpot, type Point } from './verbs.ts';

export type InputContext = {
  /** The chapter's unlocked verbs; the world verbs among them are the tools. */
  tools: () => readonly Verb[];
  /** Creatures in id order. `away` ones are skipped by Tab. */
  creatures: () => readonly { id: string; state: string }[];
  benchSpots: () => readonly BenchSpot[];
  /** What the place tool sets in this chapter. */
  placeKind: () => Exclude<Structure['kind'], 'path'>;
  /** The water rectangles a bridge snaps into. */
  water: () => readonly Rect[];
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
  view: () => ViewName;
  /** One zoom step; called only while the zoom verb is unlocked. */
  zoom: (dir: 'in' | 'out') => void;
  /** Both warmths above the friend threshold. */
  isFriend: (a: string, b: string) => boolean;
  /** The creature the thread tool marked, which the next thread starts from. Owned by the caller, so the HUD shows it. */
  threadFrom: () => string | null;
  setThreadFrom: (id: string | null) => void;
  /** Opens the whisper card for `target`, which sends the whisper. */
  openWhisper: (target: string) => void;
  /** The hero's standing manner (ADR 0013 item 2) that the manner keys change one half of. */
  manner: () => { reply: BidReply; gift: GiftMove };
  /** The player's hero kind, or null without a hero. */
  heroKind: () => HeroKind | null;
  /** The hero's berries; 0 without a hero. */
  heroBerries: () => number;
  /** Whether the hero has joined the flock (Murmuration Fen). */
  heroFlying: () => boolean;
  /** The keepsakes the hero still holds, in order. */
  keepsakes: () => readonly string[];
};

/** The hero's creature id (sim/types.ts HERO, which input may not import as a value). */
export const HERO = 'hero';

export const CURSOR_STEP = 20;
/** How far a keyboard gust or a click's gust blows, in scene units. */
const GUST = 300;
/** Enter's gust blows east before any arrow, and a click's always does. */
export const EAST: Point = { x: 1, y: 0 };
const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: EAST,
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};
/** While the respond tool is active: G glow back, H hold still, R rumble. With manner: wave back, stay still, snap. */
const REPLY_KEYS: Record<string, BidReply> = { g: 'toward', h: 'away', r: 'against' };
/** While the manner tool is active: O give, K keep. */
const GIFT_KEYS: Record<string, GiftMove> = { o: 'give', k: 'keep' };
const ZOOM_KEYS: Record<string, 'in' | 'out'> = { z: 'out', x: 'in' };

/** The current tool if it is unlocked, else the first tool. */
export function activeTool(ctx: InputContext): WorldVerb | null {
  const tools = keyboardTools(ctx.tools());
  const t = ctx.tool();
  return tools.find((v) => v === t) ?? tools[0] ?? null;
}

/**
 * Sends a thread from the marked creature to `to`: tied unless they are friends, which cuts it. A
 * thread is a friendship (spec 9.1): tying one lifts both warmths above the friend threshold.
 */
export function threadTo(ctx: InputContext, from: string, to: string): void {
  ctx.act({ verb: 'thread', a: from, b: to, on: !ctx.isFriend(from, to) });
}

/** Waves at `who` (a walk to it), unless it is the hero itself. */
export function waveAt(ctx: InputContext, who: string): void {
  if (who !== HERO) ctx.act({ verb: 'walk', to: who });
}

/**
 * Enter with the active tool at `at`, the cursor or a click's scene point. `clear` is Shift, which
 * clears fog; `dir` is the gust's direction.
 */
export function useTool(ctx: InputContext, at: Point, clear: boolean, dir: Point): void {
  const picked = ctx.picked();
  const { x, y } = at;
  switch (activeTool(ctx)) {
    case 'wake':
      if (picked !== null) ctx.act({ verb: 'wake', who: picked });
      break;
    case 'respond':
      ctx.act({ verb: 'respond', reply: ctx.reply() });
      break;
    case 'place': {
      const kind = ctx.placeKind();
      const p =
        kind === 'bench'
          ? snapToBench(at, ctx.benchSpots())
          : kind === 'bridge'
            ? snapToWater(at, ctx.water())
            : at;
      if (p) ctx.act({ verb: 'place', x: p.x, y: p.y });
      break;
    }
    case 'shine':
      ctx.act({ verb: 'shine', x, y });
      break;
    case 'fog':
      ctx.act({ verb: 'fog', x, y, clear });
      break;
    case 'blow':
      ctx.act({ verb: 'blow', x, y, dx: dir.x * GUST, dy: dir.y * GUST });
      break;
    case 'whisper':
      if (picked !== null) ctx.openWhisper(picked);
      break;
    case 'thread': {
      const from = ctx.threadFrom();
      if (picked === null || picked === from) break;
      if (from === null) {
        ctx.setThreadFrom(picked);
      } else {
        threadTo(ctx, from, picked);
        ctx.setThreadFrom(null);
      }
      break;
    }
    case 'walk':
      ctx.act({ verb: 'walk', x, y });
      break;
    case 'join':
      ctx.act({ verb: 'join', on: !ctx.heroFlying() });
      break;
    case 'pose':
      ctx.act({ verb: 'pose' });
      break;
    case 'keepsake': {
      const item = ctx.keepsakes()[0];
      if (picked !== null && picked !== HERO && item !== undefined)
        ctx.act({ verb: 'keepsake', to: picked, item });
      break;
    }
    // The manner goes with its keys and buttons.
    case 'manner':
    case null:
      break;
  }
}

export function createKeyboard(target: EventTarget, ctx: InputContext): () => void {
  /** The last arrow's direction, which the blow tool gusts in. */
  let dir = EAST;

  const onKey = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (k.ctrlKey || k.metaKey || k.altKey) return;
    const t = k.target as { tagName?: string; isContentEditable?: boolean } | null;
    const tag = t?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;

    const key = k.key;
    const lower = key.toLowerCase();
    // Native activation of buttons and links must fire once, not also act here.
    if ((key === 'Enter' || key === ' ') && (tag === 'BUTTON' || tag === 'A')) return;
    if (key >= '1' && key <= '3') {
      const t2 = keyboardTools(ctx.tools())[Number(key) - 1];
      if (t2 !== undefined) ctx.setTool(t2);
    } else if (key in ARROWS) {
      dir = ARROWS[key] as Point;
      const c = ctx.cursor();
      ctx.moveCursor({ x: c.x + dir.x * CURSOR_STEP, y: c.y + dir.y * CURSOR_STEP });
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
      // Prevented, so a card that Enter opens does not take the same press as a click on its first button.
      k.preventDefault();
      useTool(ctx, ctx.cursor(), k.shiftKey, dir);
    } else if (key === 'Escape') {
      // Claimed only to clear a mark, so the screen's own Escape (to the tools) waits for the next.
      if (ctx.threadFrom() === null) return;
      ctx.setThreadFrom(null);
      k.preventDefault();
    } else if (key === ' ') {
      ctx.togglePause();
      k.preventDefault();
    } else if (lower in ZOOM_KEYS && ctx.tools().includes('zoom')) {
      ctx.zoom(ZOOM_KEYS[lower] as 'in' | 'out');
    } else if (lower in REPLY_KEYS && activeTool(ctx) === 'respond') {
      ctx.setReply(REPLY_KEYS[lower] as BidReply);
    } else if (lower in REPLY_KEYS && activeTool(ctx) === 'manner') {
      ctx.act({ verb: 'manner', reply: REPLY_KEYS[lower] as BidReply, gift: ctx.manner().gift });
    } else if (lower in GIFT_KEYS && activeTool(ctx) === 'manner') {
      ctx.act({ verb: 'manner', reply: ctx.manner().reply, gift: GIFT_KEYS[lower] as GiftMove });
    } else if (
      lower === 'l' &&
      activeTool(ctx) === 'manner' &&
      ctx.heroKind() === 'seedcarrier' &&
      ctx.heroBerries() >= tuning.knack.seedCost
    ) {
      ctx.act({ verb: 'plant' });
    } else if (lower === 'w' && activeTool(ctx) === 'walk') {
      const picked = ctx.picked();
      if (picked !== null) waveAt(ctx, picked);
    }
  };

  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('keydown', onKey);
  };
}
