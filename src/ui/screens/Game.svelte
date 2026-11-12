<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { BenchSpot } from '../../input/verbs.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { BidReply } from '../../sim/types.ts';
  import type { ChapterRunner, Prompt } from '../../story/chapter-runner.ts';
  import type { Flags } from '../../story/flags.ts';
  import { displayName } from '../../story/names.ts';
  import { WORLD_VERBS } from '../../story/verbs.ts';
  import type { Verb, VerbInput, WorldVerb } from '../../story/verbs.ts';
  import type { GameService, Stage } from '../game-service.ts';
  import type { Settings } from '../settings.ts';
  import BeatLine from '../components/BeatLine.svelte';
  import BetCard from '../components/BetCard.svelte';
  import ChapterRibbon from '../components/ChapterRibbon.svelte';
  import Drawer from '../components/Drawer.svelte';
  import TimeControls from '../components/TimeControls.svelte';
  import ToolTray from '../components/ToolTray.svelte';

  let {
    game,
    settings,
    resume,
    onExit,
  }: { game: GameService; settings: Writable<Settings>; resume: boolean; onExit: () => void } = $props();

  /**
   * One line of prompt text per new verb (spec 12.6). The bet card is its own prompt; a verb with
   * no line here gets none.
   */
  const HINTS: Partial<Record<Verb, string>> = {
    wake: '[PLACEHOLDER] Pick a sleeper with Tab or a click, then press Enter to wake it.',
    respond: '[PLACEHOLDER] When Pim waves, press G, H, or R, then Enter to answer the sky.',
    place: '[PLACEHOLDER] Choose a spot with the arrow keys or a click, then press Enter to set a bench.',
  };
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

  let sceneEl: HTMLElement;
  let trayEl: HTMLElement | undefined = $state();
  let index = $state(0);
  let tools: WorldVerb[] = $state([]);
  let tool: Verb | null = $state(null);
  /** Tools used up in this chapter (a bench is placed once, spec 6.2). */
  let used: Verb[] = $state([]);
  let reply: BidReply = $state('toward');
  /** The last few story lines, hints, and results; new ones are announced. */
  let lines: { id: number; text: string }[] = $state([]);
  let lineId = 0;
  let bet: { question: string; options: string[] } | null = $state(null);
  let betRunning = $state(false);
  let picked: string | null = $state(null);
  let pickedState = $state('');
  let cursor = $state({ x: 0, y: 0 });
  let ghost: Verb | null = $state(null);
  let speedNow = $state(0);
  let ended: 'done' | 'failed' | null = $state(null);

  let stage: Stage | null = null;
  let runner: ChapterRunner | null = null;
  let prev: WorldLite | null = null;
  let next: WorldLite | null = null;
  let prevAt = 0;
  let nextAt = 0;
  let raf: number | null = null;
  let hidden = document.visibilityState === 'hidden';
  let ghostTimer: ReturnType<typeof setTimeout> | undefined;
  let unpauseSpeed = 1;

  // The service never changes, so these are made once.
  const hints = untrack(() => game.input.createHints());
  const overPoke = untrack(() => game.input.createOverPoke());

  const chapter = $derived(game.chapters[index]);
  /** "Chapter n: Title" with n from the id `ch<n>`, or "Interlude: Title". */
  const heading = $derived(
    chapter
      ? `${chapter.kind === 'interlude' ? 'Interlude' : `Chapter ${chapter.id.replace(/^ch/, '')}`}: ${chapter.title}`
      : '',
  );
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
  /** What the tool would act on, as text: the bench spot, or the picked creature. */
  const status = $derived(
    tool === 'place'
      ? `Bench spot: ${spotName}`
      : picked
        ? `Picked: ${displayName(picked)}${pickedState ? `, ${pickedState}` : ''}`
        : '',
  );

  function say(text: string): void {
    lines = [...lines.slice(-2), { id: (lineId += 1), text }];
  }

  function act(v: VerbInput): void {
    hints.activity();
    if (!runner) return;
    if (runner.verb(v)) {
      hints.used(v.verb);
      if (v.verb === 'place') used = [...used, 'place'];
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
    if (bet || betRunning) return;
    const now = game.currentSpeed();
    if (now > 0) {
      unpauseSpeed = now;
      setSpeed(0);
    } else {
      setSpeed(unpauseSpeed);
    }
  }

  function onPrompt(p: Prompt): void {
    if (p.kind === 'line') say(p.text);
    else if (p.kind === 'bet') bet = { question: p.question, options: p.options };
    else {
      betRunning = false;
      say(`Your guess: ${displayName(p.answer)}. The answer: ${displayName(p.result)}.`);
    }
  }

  function answer(option: string): void {
    hints.used('bet');
    bet = null;
    betRunning = true;
    runner?.answerBet(option);
  }

  function begin(i: number, flags: Flags): void {
    const chapter = game.chapters[i];
    if (!chapter || !stage) return;
    index = i;
    bet = null;
    betRunning = false;
    picked = null;
    used = [];
    prev = next = null;
    tools = WORLD_VERBS.filter((v) => chapter.verbs.includes(v));
    const verb = chapter.newVerb;
    tool = tools.find((v) => v === verb) ?? tools[0] ?? null;
    cursor = stage.benchSpots[0] ?? { x: 0, y: 0 };
    stage.setShot(null);
    stage.setFocus(null);
    stage.setSeason(chapter.season);
    stage.showHeatmap(false);

    const r = game.startChapter(chapter, flags);
    runner = r;
    r.onPrompt(onPrompt);
    r.onCamera((shot) => stage?.setShot(shot));
    r.onFocus((id) => stage?.setFocus(id));
    r.onShow(() => stage?.showHeatmap(true));
    // The new verb's line comes at once; the ghost hand waits for 10 s of idle (spec 12.6).
    const hint = verb === null ? undefined : HINTS[verb];
    if (verb !== null && hint !== undefined && chapter.verbs.includes(verb)) {
      say(hint);
      hints.unlock(verb);
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

  function onSceneKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') trayEl?.querySelector('button')?.focus();
  }

  onMount(() => {
    const offs: (() => void)[] = [];
    let gone = false;
    const isGone = (): boolean => gone;
    const activity = (): void => {
      hints.activity();
    };
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
        prev = next ?? lite;
        next = lite;
        prevAt = nextAt;
        nextAt = performance.now();
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
      const ctx = {
        tools: () => tools,
        creatures: () =>
          [...(next?.creatures ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        benchSpots: () => s.benchSpots,
        cursor: () => cursor,
        tool: () => tool,
        setTool: (v: Verb) => (tool = v),
        reply: () => reply,
        setReply: (r: BidReply) => (reply = r),
        act,
        togglePause,
        picked: () => picked,
        select: (id: string | null) => (picked = id),
        moveCursor: (p: { x: number; y: number }) => (cursor = p),
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
      for (const off of offs) off();
      window.removeEventListener('keydown', activity);
      window.removeEventListener('pointerdown', activity);
      document.removeEventListener('visibilitychange', onVisibility);
      hints.dispose();
      game.speed(0);
      stage?.destroy();
    };
  });
</script>

<div class="game">
  <!-- Everything but the bet card goes inert while the card is open. -->
  <div class="layer" inert={bet !== null}>
    <!-- The scene is a keyboard surface (spec 12.5): Tab picks creatures, Escape leaves it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="scene"
      role="application"
      aria-label="The meadow"
      aria-describedby="scene-help"
      tabindex="0"
      bind:this={sceneEl}
      onkeydown={onSceneKey}
    ></div>
    <p id="scene-help" class="sr-only">
      Tab picks a creature, the arrow keys move the bench spot, Enter uses the tool, Space pauses, and Escape
      moves to the tools.
    </p>

    {#if ended}
      <main class="end">
        <h1 id="end-title" tabindex="-1">
          {ended === 'done' ? 'End of the year so far' : 'This chapter stopped'}
        </h1>
        <p>
          {ended === 'done'
            ? '[PLACEHOLDER] The chapters so far are done, and the rest of the year is still to come.'
            : 'Something in the chapter content went wrong.'}
        </p>
        <button type="button" onclick={onExit}>Back to title</button>
      </main>
    {:else}
      <main class="hud">
        <h1 class="title">{heading}</h1>
        <div class="drawer">
          <Drawer notes={chapter?.notes ?? []} />
        </div>
        <div class="bottom">
          <BeatLine {lines} />
          <!-- Always rendered, so a screen reader announces each change of the pick or bench spot. -->
          <p class="status" class:empty={!status} role="status">{status}</p>
          <div bind:this={trayEl}>
            <ToolTray
              {tools}
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
          </div>
          <ChapterRibbon count={game.chapters.length} current={index} onSkip={() => runner?.skip()} />
        </div>
        <div class="time">
          <TimeControls speed={speedNow} disabled={betRunning} onPause={togglePause} onSpeed={setSpeed} />
        </div>
      </main>
    {/if}
  </div>
  {#if bet}
    <BetCard question={bet.question} options={bet.options} label={displayName} onAnswer={answer} />
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
    top: 0.5rem;
    right: 0.75rem;
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
    background: var(--bg);
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
