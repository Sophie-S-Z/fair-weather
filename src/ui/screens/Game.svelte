<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { InputContext } from '../../input/keyboard.ts';
  import type { BenchSpot } from '../../input/verbs.ts';
  import type { ViewName } from '../../input/zoom.ts';
  import type { MythPage } from '../../myth/grammar.ts';
  import type { BookPage } from '../../persist/profile.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { BidReply } from '../../sim/types.ts';
  import type { ChapterRunner, Prompt } from '../../story/chapter-runner.ts';
  import type { Flags } from '../../story/flags.ts';
  import { displayName } from '../../story/names.ts';
  import { chapterTicksPerDay } from '../../story/scenario.ts';
  import { unlockingVerb, VERBS, WORLD_VERBS } from '../../story/verbs.ts';
  import type { Verb, VerbInput, WorldVerb } from '../../story/verbs.ts';
  import type { GameService, Stage } from '../game-service.ts';
  import type { Settings } from '../settings.ts';
  import { chapterHeading } from '../chapter-label.ts';
  import BeatLine from '../components/BeatLine.svelte';
  import BetCard from '../components/BetCard.svelte';
  import ChapterRibbon from '../components/ChapterRibbon.svelte';
  import CosmosPanel from '../components/CosmosPanel.svelte';
  import Drawer from '../components/Drawer.svelte';
  import MythScroll from '../components/MythScroll.svelte';
  import TimeControls from '../components/TimeControls.svelte';
  import ToolTray from '../components/ToolTray.svelte';
  import WhisperCard from '../components/WhisperCard.svelte';
  import Bubbles from '../interludes/Bubbles.svelte';
  import Postcard from '../interludes/Postcard.svelte';
  import Rhythm from '../interludes/Rhythm.svelte';
  import Stillness from '../interludes/Stillness.svelte';
  import Telephone from '../interludes/Telephone.svelte';
  import BookOfSkies from './BookOfSkies.svelte';

  let {
    game,
    settings,
    resume,
    onExit,
  }: { game: GameService; settings: Writable<Settings>; resume: boolean; onExit: () => void } = $props();

  /**
   * The verbs with a line of prompt text when new (spec 12.6, P1): each tray verb, also when a
   * chapter brings two, listen, and the mind verbs. The bet card is its own prompt.
   */
  const HINT_VERBS = [...WORLD_VERBS, 'listen', 'peek', 'zoom', 'rewind'] as const;
  const HINTS: Record<(typeof HINT_VERBS)[number], string> = {
    wake: '[PLACEHOLDER] Pick a sleeper with Tab or a click, then press Enter to wake it.',
    respond: '[PLACEHOLDER] When Pim waves, press G, H, or R, then Enter to answer the sky.',
    place: '[PLACEHOLDER] Choose a spot with the arrow keys or a click, then press Enter to set a bench.',
    shine:
      '[PLACEHOLDER] Move the spot with the arrow keys or a click, then press Enter to shine the sun there.',
    whisper: '[PLACEHOLDER] Pick a creature, then press Enter to whisper to it about another.',
    thread:
      '[PLACEHOLDER] Pick a creature and press Enter, then pick another and press Enter to tie or cut a thread. Escape lets go.',
    fog: '[PLACEHOLDER] Press Enter to paint fog at the spot, or Shift+Enter to clear it.',
    blow: '[PLACEHOLDER] Press Enter to blow a gust the way the arrow keys last pointed, or drag across the meadow.',
    walk: '[PLACEHOLDER] Press Enter to walk to the spot, or pick a creature to wave at it.',
    manner: '[PLACEHOLDER] Choose how your hero answers and whether it gives or keeps.',
    join: '[PLACEHOLDER] Press Enter to fly with the flock, or to land.',
    pose: '[PLACEHOLDER] Press Enter to pose for the gazette.',
    keepsake: '[PLACEHOLDER] Pick a creature, then press Enter to give it a keepsake.',
    zoom: '[PLACEHOLDER] Press Z to zoom out to who is friends with whom, and X to zoom back in. A wheel or a pinch works too.',
    peek: '[PLACEHOLDER] Pick a creature, then press P to peek under the hood at its numbers. The Diary and notes drawer shows them too.',
    rewind:
      '[PLACEHOLDER] In the Cosmos, move the Rewind slider to look back; each mark is a friendship that ended. Back to now returns.',
    listen: '[PLACEHOLDER] Press Listen to hear the next verse of the story.',
  };
  const VIEW_NAMES: Record<ViewName, string> = {
    meadow: 'The meadow',
    cosmos: 'The Cosmos: who is friends with whom',
    soul: 'The Soul view',
  };
  /** The tools that act at the cursor. */
  const POINT_TOOLS: ReadonlySet<Verb> = new Set(['place', 'shine', 'fog', 'blow']);
  /** How near the cursor a creature is named in the status line, in scene units: two cursor steps. */
  const NEAR = 40;
  const STATES: Record<string, string> = {
    sleep: 'asleep',
    wander: 'awake',
    meet: 'meeting',
    leave: 'leaving',
    away: 'away',
  };
  /** Said when the player answers the sky and no one is waving at it (the runner sends nothing). */
  const NO_BID = '[PLACEHOLDER] Nobody is waving at the sky right now.';
  /** How long the ghost hand stays, in milliseconds. */
  const GHOST_MS = 4000;
  const VISITOR_COMES = '[PLACEHOLDER] A quiet visitor walks in and sits down to rest.';
  const VISITOR_GOES = '[PLACEHOLDER] The visitor left a feather. It is kept in the Book of Skies.';

  let sceneEl: HTMLElement;
  let trayEl: HTMLElement | undefined = $state();
  /** The open activity; focus moves to its first control when it opens. */
  let activityEl: HTMLElement | undefined = $state();
  let index = $state(0);
  let tools: WorldVerb[] = $state([]);
  let tool: Verb | null = $state(null);
  /** Tools used up in this chapter (a bench is placed once, spec 6.2). */
  let used: Verb[] = $state([]);
  /** How many things the place tool has set in this chapter. */
  let placed = 0;
  let reply: BidReply = $state('toward');
  /** The last few story lines, hints, and results; new ones are announced. */
  let lines: { id: number; text: string; reveal: boolean }[] = $state([]);
  let lineId = 0;
  /** How long a bet's answer stays into the next chapter. */
  const REVEAL_MS = 8000;
  /** Takes the last chapter's answer off the lines; cleared by the next chapter and on unmount. */
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  let bet: { question: string; options: string[] } | null = $state(null);
  let betRunning = $state(false);
  let picked: string | null = $state(null);
  let pickedState = $state('');
  /** The creature not away nearest the cursor within NEAR, or null. */
  let nearby: string | null = $state(null);
  let cursor = $state({ x: 0, y: 0 });
  let ghost: Verb | null = $state(null);
  let speedNow = $state(0);
  let ended: 'done' | 'failed' | null = $state(null);
  /** The flags the chapter started with, and the fire's myth once its first snapshot is in. */
  let flagsNow: Flags | null = null;
  let myth: MythPage | null = $state.raw(null);
  let view: ViewName = $state('meadow');
  /** The creature the thread tool marked. */
  let threadFrom: string | null = $state(null);
  /** The open whisper card: the creature it whispers to, and those it can be about. */
  let whisperCard: { target: string; others: string[] } | null = $state(null);
  /** The newest live snapshot and its tick, and this run's Cosmos timeline. */
  let live: WorldLite | null = $state.raw(null);
  let liveTick = $state(0);
  let timeline: ReturnType<Stage['timeline']> = $state.raw({ points: [], breaks: [] });
  /**
   * The tick the rewind range asks for, or null for now; the rewound world once it arrives. While
   * rewound the sim is paused and verbs send nothing (ADR 0012 item 10).
   */
  let rewindAt: number | null = $state(null);
  let rewound: WorldLite | null = $state.raw(null);
  /** Only the newest rewind request is drawn. */
  let rewindRequest = 0;
  let speedBeforeRewind = 1;
  /** Where the drawer opens next: P opens it at Under the hood, the Soul view at Diary. */
  let drawerAt: { section: 'diary' | 'peek'; focus: boolean } | null = $state.raw(null);
  let drawerEl: HTMLElement | undefined = $state();
  let drawerWidth = $state(0);
  // Widened, since only the bind on the Drawer writes it.
  let drawerOpen = $state(false as boolean);
  /** The pixels the drawer takes from the scene's right edge, and the height of the HUD at the bottom. */
  let inset = $state(0);
  let hudHeight = $state(0);
  /** The Cosmos timeline band and the empty slot in it where the canvas draws the strip. */
  let bandEl: HTMLElement | undefined = $state();
  let stripEl: HTMLElement | undefined = $state();
  let bandWidth = $state(0);
  let bandHeight = $state(0);
  /** The open Book of Skies, a modal dialog with the sim paused, and the speed it puts back. */
  let book: { pages: BookPage[]; feathers: number } | null = $state.raw(null);
  let bookOpening = $state(false);
  /** Whether the Book of Skies has a page, so the drawer offers it, as the title does. */
  let hasBook = $state(false);
  let speedBeforeBook = 0;
  /** The finished year's myth on its way into the book. */
  let keptMyth: Promise<void> = Promise.resolve();
  /** Back to the title once the year's page is kept, so the title reads the saves after it. */
  function exit(): void {
    void keptMyth.then(onExit);
  }
  /**
   * The Quiet Visitor comes once per chapter (ADR 0012 item 12). `due` is set when the wait fires,
   * and the visit waits until nothing covers the Meadow. `visitToken` changes when a visit is cut
   * off, so a visit that ends with its chapter leaves no feather.
   */
  let visited = false;
  let due = $state(false);
  let visitToken = 0;

  let stage: Stage | null = $state.raw(null);
  let runner: ChapterRunner | null = null;
  let prev: WorldLite | null = null;
  let next: WorldLite | null = null;
  let prevAt = 0;
  let nextAt = 0;
  let raf: number | null = null;
  let hidden = $state(document.visibilityState === 'hidden');
  let ghostTimer: ReturnType<typeof setTimeout> | undefined;
  let unpauseSpeed = 1;

  // The service never changes, so these are made once.
  const hints = untrack(() => game.input.createHints());
  const overPoke = untrack(() => game.input.createOverPoke());
  const wait = untrack(() => game.input.createWait());

  const chapter = $derived(game.chapters[index]);
  /** The world drawn now, and what the Cosmos panel and the drawer say about it. */
  // In closures, so TypeScript does not narrow the state to its first value.
  const shown = $derived.by(() => rewound ?? live);
  const ties = $derived.by(() => (shown && (view === 'cosmos' || picked !== null) ? game.ties(shown) : null));
  const diary = $derived.by(() => {
    const c = shown?.creatures.find((x) => x.id === picked);
    if (!c || !chapter) return null;
    const mine = ties?.get(c.id);
    const away = new Set(shown?.creatures.filter((x) => x.state === 'away').map((x) => x.id));
    // The Cosmos panel's rule too: away ones count, marked away.
    const named = (id: string): string => `${displayName(id)}${away.has(id) ? ' (away)' : ''}`;
    return {
      name: displayName(c.id),
      lines: runner?.diary(c.id) ?? [],
      // The diary lines are the live ones; the rest is the rewound world.
      linesNow: rewound !== null,
      dials: c.dials,
      friends: (mine?.friends ?? []).map(named),
      scars: (mine?.scars ?? []).map(named),
      peek: chapter.verbs.includes('peek') ? game.peek(c.dials) : null,
    };
  });
  const placeKind = $derived(chapter?.place.kind ?? 'bench');
  /** A point tool acts at the cursor, which the Meadow then draws and the status line names. */
  const pointing = $derived(view === 'meadow' && tool !== null && POINT_TOOLS.has(tool));
  const heading = $derived(chapter ? chapterHeading(chapter) : '');
  const spotName = $derived.by(() => {
    let best: BenchSpot | undefined;
    let bestD = Infinity;
    for (const s of stage?.benchSpots ?? []) {
      const d = (s.x - cursor.x) ** 2 + (s.y - cursor.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best ? best.id.replace(/-/g, ' ') : '';
  });
  /**
   * What the tool would act on, as text: the bench spot, the cursor's nearest spot and creature, or
   * the picked creature; then the thread mark and the view.
   */
  const status = $derived(
    [
      tool === 'place' && placeKind === 'bench'
        ? `Bench spot: ${spotName}`
        : pointing
          ? `Spot near: ${spotName}${nearby === null ? '' : `, by ${displayName(nearby)}`}`
          : picked
            ? `Picked: ${displayName(picked)}${pickedState ? `, ${pickedState}` : ''}`
            : '',
      tool === 'thread' && threadFrom !== null ? `Thread from ${displayName(threadFrom)}` : '',
      view === 'meadow' ? '' : VIEW_NAMES[view],
      rewindAt === null ? '' : 'Rewound: the tools wait for Back to now',
    ]
      .filter((part) => part !== '')
      .join('. '),
  );

  function say(text: string, reveal = false): void {
    lines = [...lines.slice(-2), { id: (lineId += 1), text, reveal }];
  }

  function act(v: VerbInput): void {
    hints.activity();
    if (!runner || rewindAt !== null) return;
    if (runner.verb(v)) {
      hints.used(unlockingVerb(v));
      if (v.verb === 'place') {
        placed += 1;
        if (placed === chapter?.place.limit) used = [...used, 'place'];
      }
    } else if (v.verb === 'respond') {
      say(NO_BID);
    }
    if (v.verb === 'wake' && overPoke.poke()) runner.overPoke();
  }

  function setSpeed(m: number): void {
    game.speed(m);
    speedNow = m;
  }
  function togglePause(): void {
    if (bet || betRunning || rewindAt !== null) return;
    const now = game.currentSpeed();
    if (now > 0) {
      unpauseSpeed = now;
      setSpeed(0);
    } else {
      setSpeed(unpauseSpeed);
    }
  }

  /**
   * Opens the Book of Skies with the sim paused, after the year's myth is kept. Not while a bet's
   * answer plays, since the pause would take the runner's speed.
   */
  async function openBook(): Promise<void> {
    if (book || bookOpening || betRunning) return;
    bookOpening = true;
    if (!ended) {
      speedBeforeBook = game.currentSpeed();
      setSpeed(0);
    }
    await keptMyth;
    const [pages, feathers] = await Promise.all([game.book(), game.feathers()]);
    bookOpening = false;
    book = { pages, feathers };
  }
  async function loadHasBook(): Promise<void> {
    hasBook = (await game.book()).length > 0;
  }
  function closeBook(): void {
    book = null;
    if (!ended) setSpeed(speedBeforeBook);
  }

  /** Brings the Quiet Visitor once it is due, once per chapter. The effect below calls it when nothing covers the Meadow. */
  function visit(): void {
    if (visited || !stage) return;
    visited = true;
    due = false;
    const token = visitToken;
    say(VISITOR_COMES);
    void stage.visitor().then(async () => {
      if (token !== visitToken) return;
      await game.addFeather();
      say(VISITOR_GOES);
    });
  }

  /** Pauses the sim on the first move of the range, and asks for the world at `t`. */
  function rewindTo(t: number): void {
    if (rewindAt === null) {
      speedBeforeRewind = game.currentSpeed();
      setSpeed(0);
    }
    rewindAt = t;
    const request = (rewindRequest += 1);
    game.rewind(t).then(
      (lite) => {
        if (request === rewindRequest) rewound = lite;
      },
      () => undefined, // the worker restarted; the range asks again on its next move
    );
  }
  function backToNow(): void {
    if (rewindAt === null) return;
    rewindAt = null;
    rewound = null;
    rewindRequest += 1;
    setSpeed(speedBeforeRewind);
  }

  function onPrompt(p: Prompt): void {
    if (p.kind === 'line') say(p.text);
    else if (p.kind === 'bet') {
      // Answering starts the sim, so a bet that arrives while rewound brings the world back to now.
      backToNow();
      bet = { question: p.question, options: p.options };
    } else if (p.kind === 'reveal') {
      betRunning = false;
      say(`Your guess: ${displayName(p.answer)}. The answer: ${displayName(p.result)}.`, true);
    }
  }

  function finishActivity(result: string): void {
    runner?.finishActivity(result);
  }

  function answer(option: string): void {
    hints.used('bet');
    bet = null;
    betRunning = true;
    runner?.answerBet(option);
  }

  /** Cuts off a visit in progress: it resolves at once, with no feather, and the visitor leaves. */
  function endVisit(): void {
    visitToken += 1;
    stage?.endVisit();
  }
  // A due visit arrives once the Meadow shows, the tab is visible, and no card, activity, or book covers it.
  $effect(() => {
    if (!due || !stage || hidden || ended || book || bookOpening || view !== 'meadow') return;
    if (bet || betRunning || whisperCard || chapter?.activity) return;
    untrack(visit);
  });

  function begin(i: number, flags: Flags): void {
    const chapter = game.chapters[i];
    if (!chapter || !stage) return;
    index = i;
    bet = null;
    betRunning = false;
    picked = null;
    threadFrom = null;
    whisperCard = null;
    rewindAt = null;
    rewound = null;
    rewindRequest += 1;
    used = [];
    placed = 0;
    prev = next = null;
    // Each chapter is a new scene, with its own three-minute wait.
    endVisit();
    visited = false;
    due = false;
    wait.activity();
    // The last chapter's lines do not belong to this one. A bet's answer can end a chapter, so when
    // it is the newest line it stays a short time to be read, and then goes.
    clearTimeout(revealTimer);
    const answer = lines.at(-1);
    lines = answer?.reveal ? [answer] : [];
    if (answer?.reveal)
      revealTimer = setTimeout(() => (lines = lines.filter((l) => l.id !== answer.id)), REVEAL_MS);
    // An activity starts on this chapter's own first snapshot, when the runner takes its finish.
    // The host drops every message from the last chapter's worker once startChapter posts init
    // (host.ts connect), and nothing runs between here and that post, so no old world comes back.
    live = null;
    flagsNow = flags;
    myth = null;
    tools = WORLD_VERBS.filter((v) => chapter.verbs.includes(v));
    const verb = chapter.newVerb;
    tool = tools.find((v) => v === verb) ?? tools[0] ?? null;
    cursor = stage.benchSpots[0] ?? { x: 0, y: 0 };
    stage.setShot(null);
    stage.setFocus(null);
    stage.setSeason(chapter.season);
    stage.showHeatmap(false);
    view = 'meadow';
    stage.setView('meadow', null);

    // A control that goes away with the last chapter (the last bubble) leaves focus nowhere.
    void tick().then(() => {
      if (document.activeElement === document.body) sceneEl.focus();
    });

    const r = game.startChapter(chapter, flags);
    runner = r;
    r.onPrompt(onPrompt);
    r.onCamera((shot) => stage?.setShot(shot));
    r.onFocus((id) => stage?.setFocus(id));
    r.onShow(() => stage?.showHeatmap(true));
    // A new verb's line comes at once; a new tool's ghost hand waits for 10 s of idle (spec 12.6).
    const known = new Set(game.chapters.slice(0, i).flatMap((c) => c.verbs));
    for (const v of HINT_VERBS) {
      if (!chapter.verbs.includes(v) || known.has(v)) continue;
      say(HINTS[v]);
      // The ghost hand taps a tray tool, so only the world verbs get one.
      if ((WORLD_VERBS as readonly string[]).includes(v)) hints.unlock(v);
    }
    r.done.then(
      (out) => {
        if (runner !== r) return;
        if (i + 1 < game.chapters.length) begin(i + 1, out);
        else finish('done');
      },
      () => {
        if (runner === r) finish('failed');
      },
    );
  }

  function finish(how: 'done' | 'failed'): void {
    // The finished year's myth becomes the next page of the Book of Skies (spec 10.6 item 7).
    const page = how === 'done' ? (myth ?? (flagsNow ? game.myth(flagsNow) : null)) : null;
    if (page) keptMyth = game.keepMyth(page).then(loadHasBook);
    endVisit();
    runner = null;
    setSpeed(0);
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    ended = how;
    void tick().then(() => document.getElementById('end-title')?.focus());
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    speedNow = game.currentSpeed();
    if (stage && rewound) {
      stage.draw(rewound, rewound, 1, $settings);
      return;
    }
    if (!stage || !prev || !next) return;
    const span = nextAt - prevAt;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (now - nextAt) / span)) : 1;
    stage.draw(prev, next, alpha, $settings);
  }

  /** The frame loop stops while the tab is hidden; main.ts holds the sim at speed 0 meanwhile. */
  function onVisibility(): void {
    hidden = document.visibilityState === 'hidden';
    if (hidden) {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    } else if (stage && !ended && raf === null) {
      raf = requestAnimationFrame(frame);
    }
  }

  // The Soul view, and the HUD at the bottom while the drawer is open, keep clear of the drawer.
  $effect(() => {
    if (!drawerEl || drawerWidth === 0) return;
    inset = sceneEl.getBoundingClientRect().right - drawerEl.getBoundingClientRect().left;
  });
  $effect(() => {
    stage?.setInsets({ right: drawerOpen ? inset : 0, bottom: hudHeight });
  });
  // The Cosmos draws its timeline strip in the band's slot, and the valley fits below the band.
  $effect(() => {
    if (!stage) return;
    if (!bandEl || !stripEl || bandWidth === 0 || bandHeight === 0) {
      stage.setTimelineBand(null);
      return;
    }
    const at = sceneEl.getBoundingClientRect();
    const r = stripEl.getBoundingClientRect();
    stage.setTimelineBand({
      strip: { x: r.left - at.left, y: r.top - at.top, w: r.width, h: r.height },
      bottom: bandEl.getBoundingClientRect().bottom - at.top,
    });
  });

  $effect(() => {
    activityEl?.querySelector('button')?.focus();
  });

  // The Meadow draws the cursor while a point tool is active.
  $effect(() => {
    stage?.setCursor(pointing ? { x: cursor.x, y: cursor.y } : null);
  });

  /**
   * Escape moves to the tools, unless the keyboard took it to let go of a thread mark. P peeks:
   * the drawer opens at Under the hood for the picked creature.
   */
  function onSceneKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !e.defaultPrevented) trayEl?.querySelector('button')?.focus();
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (plain && e.key.toLowerCase() === 'p' && diary?.peek) drawerAt = { section: 'peek', focus: true };
    if (plain && e.key.toLowerCase() === 'b') void openBook();
  }

  /** The creature not away whose feet are nearest `p`, within NEAR scene units, or null. */
  function nearbyAt(p: { x: number; y: number }): string | null {
    let best: string | null = null;
    let bestD = NEAR;
    for (const c of next?.creatures ?? []) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (c.state !== 'away' && d <= bestD) {
        bestD = d;
        best = c.id;
      }
    }
    return best;
  }

  /** Opens the whisper card for `target`, about every other named creature (spec 5.3) not gone, in id order. */
  function openWhisper(target: string): void {
    if (rewindAt !== null) return;
    const others = (next?.creatures ?? [])
      .filter((c) => !c.gone && c.id !== target && game.castIds.includes(c.id))
      .map((c) => c.id);
    whisperCard = { target, others: others.sort() };
  }

  function whisper(about: string, sign: 1 | -1): void {
    const card = whisperCard;
    whisperCard = null;
    if (card) act({ verb: 'whisper', target: card.target, about, sign });
  }

  onMount(() => {
    const offs: (() => void)[] = [];
    let gone = false;
    const isGone = (): boolean => gone;
    const activity = (): void => {
      hints.activity();
      wait.activity();
    };
    wait.onVisit(() => {
      due = true;
    });
    void loadHasBook();
    window.addEventListener('keydown', activity);
    window.addEventListener('pointerdown', activity);
    document.addEventListener('visibilitychange', onVisibility);
    hints.onHint((v) => {
      ghost = v;
      clearTimeout(ghostTimer);
      ghostTimer = setTimeout(() => (ghost = null), GHOST_MS);
    });
    offs.push(
      game.onSnapshot((lite, at) => {
        stage?.snapshot(at, lite);
        if (stage) timeline = stage.timeline();
        live = lite;
        liveTick = at;
        if (myth === null && flagsNow && chapter?.activity === 'fire') myth = game.myth(flagsNow);
        prev = next ?? lite;
        next = lite;
        prevAt = nextAt;
        nextAt = performance.now();
        nearby = nearbyAt(cursor);
        if (picked !== null)
          pickedState = STATES[lite.creatures.find((c) => c.id === picked)?.state ?? ''] ?? '';
      }),
    );

    void game.createStage(sceneEl).then(async (s) => {
      if (gone) {
        s.destroy();
        return;
      }
      stage = s;
      const ctx: InputContext = {
        // In VERBS order, which starts with the world verbs in the tray's order, so 1 to 3 match it.
        tools: () => VERBS.filter((v) => chapter?.verbs.includes(v)),
        creatures: () =>
          [...(next?.creatures ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        benchSpots: () => s.benchSpots,
        placeKind: () => placeKind,
        water: () => next?.water ?? [],
        cursor: () => cursor,
        tool: () => tool,
        setTool: (v) => (tool = v),
        reply: () => reply,
        setReply: (r) => (reply = r),
        act,
        togglePause,
        picked: () => picked,
        select: (id) => {
          picked = id;
          if (view !== 'meadow') s.setView(view, id);
        },
        moveCursor: (p) => {
          const { width, height } = s.sceneSize;
          cursor = { x: Math.min(width, Math.max(0, p.x)), y: Math.min(height, Math.max(0, p.y)) };
          nearby = nearbyAt(cursor);
        },
        view: () => view,
        zoom: (dir) => {
          const v = game.input.nextView(view, dir, picked);
          if (v === view) return;
          if (view === 'cosmos') backToNow();
          view = v;
          s.setView(v, picked);
          if (v === 'soul') drawerAt = { section: 'diary', focus: false };
        },
        isFriend: (a, b) => next !== null && game.isFriend(next, a, b),
        threadFrom: () => threadFrom,
        setThreadFrom: (id) => (threadFrom = id),
        openWhisper,
      };
      offs.push(game.input.createKeyboard(sceneEl, ctx));
      offs.push(
        game.input.createPointer(
          sceneEl,
          (x, y) => ({ creature: s.pick(x, y) }),
          (x, y) => s.toScene(x, y),
          ctx,
        ),
      );
      // Continue starts the saved chapter over from its start; no save means a new game.
      const saved = untrack(() => resume) ? await game.resume() : null;
      if (isGone()) return;
      if (saved) begin(saved.index, saved.flags);
      else begin(game.firstChapter, game.defaultFlags);
      sceneEl.focus();
      if (!hidden) raf = requestAnimationFrame(frame);
    });

    return () => {
      gone = true;
      runner = null;
      if (raf !== null) cancelAnimationFrame(raf);
      clearTimeout(ghostTimer);
      clearTimeout(revealTimer);
      for (const off of offs) off();
      window.removeEventListener('keydown', activity);
      window.removeEventListener('pointerdown', activity);
      document.removeEventListener('visibilitychange', onVisibility);
      hints.dispose();
      wait.dispose();
      game.speed(0);
      stage?.destroy();
    };
  });
</script>

<div class="game">
  <!-- Everything but the bet card, the whisper card, or the Book of Skies goes inert while one is open. -->
  <div class="layer" inert={bet !== null || whisperCard !== null || book !== null}>
    <!-- The scene is a keyboard surface (spec 12.5): Tab picks creatures, Escape leaves it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="scene"
      role="application"
      aria-label={VIEW_NAMES[view]}
      aria-describedby="scene-help"
      tabindex="0"
      bind:this={sceneEl}
      onkeydown={onSceneKey}
    ></div>
    <p id="scene-help" class="sr-only">
      {chapter?.activity
        ? 'Tab picks a creature, Space pauses, and Escape moves to the activity.'
        : 'Tab picks a creature, the arrow keys move the spot, Enter uses the tool, Space pauses, and Escape moves to the tools.'}{chapter?.verbs.includes(
        'zoom',
      )
        ? ' Z zooms out and X zooms in.'
        : ''}{chapter?.verbs.includes('peek')
        ? ' P peeks under the hood of the picked creature.'
        : ''}{chapter?.verbs.includes('rewind')
        ? ' In the Cosmos, Escape and then Shift+Tab reach the Cosmos panel and its Rewind range.'
        : ''} B opens the Book of Skies.
    </p>

    {#if ended}
      <main class="end">
        <h1 id="end-title" tabindex="-1">
          {ended === 'done' ? 'End of Part 1' : 'This chapter stopped'}
        </h1>
        {#if ended === 'done'}
          <p>
            [PLACEHOLDER] The year in Kith is done. Its sky story is a page in the Book of Skies now, and Part
            2 is still to come.
          </p>
          <!-- The whole story stays in the book, so the last verse can be read after the fire. -->
          <div class="end-actions">
            <button
              type="button"
              onclick={() => {
                void openBook();
              }}>Open the Book of Skies</button
            >
            <button type="button" onclick={exit}>Back to title</button>
          </div>
        {:else}
          <p>Something in the chapter content went wrong.</p>
          <button type="button" onclick={exit}>Back to title</button>
        {/if}
      </main>
    {:else}
      <main class="hud">
        <h1 class="title">{heading}</h1>
        <div class="drawer" bind:this={drawerEl} bind:clientWidth={drawerWidth}>
          <Drawer
            notes={chapter?.notes ?? []}
            {diary}
            openAt={drawerAt}
            bind:open={drawerOpen}
            onBook={hasBook ? () => void openBook() : undefined}
          />
        </div>
        {#if view === 'cosmos'}
          <div class="band" bind:this={bandEl} bind:clientWidth={bandWidth} bind:clientHeight={bandHeight}>
            <p class="band-label">Village size and trust this chapter</p>
            <!-- The canvas draws the strip here; the Cosmos panel says the same in words. -->
            <div class="strip" bind:this={stripEl}></div>
          </div>
        {/if}
        {#if view === 'cosmos' && shown && ties && chapter}
          <div class="cosmos">
            <CosmosPanel
              lite={shown}
              {ties}
              {timeline}
              label={displayName}
              rewind={chapter.verbs.includes('rewind')
                ? {
                    now: liveTick,
                    at: rewindAt,
                    ticksPerDay: chapterTicksPerDay(chapter),
                    disabled: bet !== null || betRunning,
                  }
                : null}
              onRewind={rewindTo}
              onBackToNow={backToNow}
            />
          </div>
        {/if}
        <div class="bottom" bind:clientHeight={hudHeight}>
          <!-- The lines, status, and tools keep clear of the open drawer; the ribbon runs full width. -->
          <div class="play" style:padding-right={drawerOpen ? `${String(inset)}px` : '0'}>
            <BeatLine {lines} />
            <!-- Always rendered, so a screen reader announces each change of the pick or bench spot. -->
            <p class="status" class:empty={!status} role="status">{status}</p>
            <div bind:this={trayEl}>
              {#if chapter?.activity}
                <!-- The activity stands in for the tool tray; Escape from the scene reaches its first button. -->
                {#if chapter.activity === 'fire'}
                  {#if myth}
                    <div class="activity" bind:this={activityEl}>
                      <MythScroll
                        page={myth}
                        finish={() => {
                          finishActivity('heard');
                        }}
                      />
                    </div>
                  {/if}
                {:else if live}
                  <div class="activity" bind:this={activityEl}>
                    {#if chapter.activity === 'rhythm'}
                      <Rhythm lite={live} finish={finishActivity} />
                    {:else if chapter.activity === 'telephone'}
                      <Telephone lite={live} finish={finishActivity} />
                    {:else if chapter.activity === 'bubbles'}
                      <Bubbles lite={live} finish={finishActivity} />
                    {:else if chapter.activity === 'postcard'}
                      <Postcard finish={finishActivity} />
                    {:else}
                      <Stillness
                        finish={finishActivity}
                        createHoldStill={game.input.createHoldStill}
                        paused={speedNow === 0}
                      />
                    {/if}
                  </div>
                {/if}
              {:else}
                <ToolTray
                  {tools}
                  {placeKind}
                  {used}
                  active={tool}
                  {reply}
                  {ghost}
                  onPick={(v: Verb) => {
                    hints.activity();
                    tool = v;
                  }}
                  onReply={(r: BidReply) => {
                    reply = r;
                    act({ verb: 'respond', reply: r });
                  }}
                />
              {/if}
            </div>
          </div>
          <ChapterRibbon chapters={game.chapters} current={index} onSkip={() => runner?.skip()} />
        </div>
        <div class="time">
          <TimeControls
            speed={speedNow}
            disabled={betRunning || rewindAt !== null}
            onPause={togglePause}
            onSpeed={setSpeed}
          />
        </div>
      </main>
    {/if}
  </div>
  {#if book}
    <BookOfSkies pages={book.pages} feathers={book.feathers} modal onBack={closeBook} />
  {:else if bet}
    <BetCard
      question={bet.question}
      options={bet.options}
      label={displayName}
      onAnswer={answer}
      home={() => {
        sceneEl.focus();
      }}
    />
  {:else if whisperCard}
    <WhisperCard
      target={whisperCard.target}
      others={whisperCard.others}
      label={displayName}
      onWhisper={whisper}
      onCancel={() => (whisperCard = null)}
    />
  {/if}
</div>

<style>
  .game,
  .layer {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .scene {
    position: absolute;
    inset: 0;
    /* Pinches and drags are the game's, not the browser's. */
    touch-action: none;
  }
  .scene:focus-visible {
    outline-offset: -6px;
  }
  .hud {
    pointer-events: none;
  }
  .hud :global(button),
  .hud :global(section) {
    pointer-events: auto;
  }
  .title {
    position: absolute;
    top: 0.5rem;
    left: 0.75rem;
    margin: 0;
    padding: 0.1rem 0.5rem;
    font-size: 1rem;
    background: var(--bg);
  }
  .drawer {
    position: absolute;
    /* Over the beat line and the tools where they meet. */
    z-index: 1;
    top: 0.5rem;
    right: 0.75rem;
  }
  .cosmos {
    position: absolute;
    top: 2.75rem;
    left: 0.75rem;
  }
  .band {
    position: absolute;
    top: 0.5rem;
    left: 25%;
    width: 50%;
    padding-bottom: 0.25rem;
    text-align: center;
  }
  /* Over the canvas, so on the page color in every theme. */
  .band-label {
    display: inline-block;
    margin: 0 0 0.25rem;
    padding: 0.1rem 0.5rem;
    background: var(--bg);
  }
  .strip {
    height: 1.5rem;
  }
  /* Too narrow to share the title's row: the band takes a row of its own, under the title and the
     drawer button, and the panel moves under it. */
  @media (max-width: 960px) {
    .band {
      top: 3.5rem;
      left: 0.75rem;
      width: auto;
      right: 0.75rem;
    }
    .cosmos {
      top: 7.75rem;
    }
  }
  .play {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .bottom {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .status {
    margin: 0;
    padding: 0 0.5rem;
    background: var(--bg);
  }
  .status.empty {
    padding: 0;
    background: none;
  }
  .time {
    position: absolute;
    right: 0.75rem;
    bottom: 3.5rem;
  }
  .end {
    position: absolute;
    inset: 0;
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1rem;
    overflow-y: auto;
    background: var(--bg);
  }
  .end-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .activity {
    max-width: min(40rem, calc(100vw - 1.5rem));
    padding: 0.5rem 0.75rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  .activity :global(p) {
    margin: 0.25rem 0;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
