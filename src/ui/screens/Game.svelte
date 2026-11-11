<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { BenchSpot } from '../../input/verbs.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { BidReply } from '../../sim/types.ts';
  import type { ChapterRunner, Prompt } from '../../story/chapter-runner.ts';
  import type { Flags } from '../../story/flags.ts';
  import type { Verb, VerbInput } from '../../story/verbs.ts';
  import type { GameService, Stage } from '../game-service.ts';
  import type { Settings } from '../settings.ts';
  import BeatLine from '../components/BeatLine.svelte';
  import BetCard from '../components/BetCard.svelte';
  import ChapterRibbon from '../components/ChapterRibbon.svelte';
  import TimeControls from '../components/TimeControls.svelte';
  import ToolTray from '../components/ToolTray.svelte';

  let { game, settings, onExit }: { game: GameService; settings: Writable<Settings>; onExit: () => void } =
    $props();

  /** One line of prompt text per new verb (spec 12.6), shown with the ghost hand. */
  const HINTS: Record<Verb, string> = {
    wake: 'Wake: press Tab to pick a sleeper, then Enter. Or click one.',
    respond: 'Respond: when Pim waves, press G, H, or R, then Enter. Or use a reply button.',
    bet: 'Bet: pick one answer on the card.',
    place: 'Bench: move with the arrow keys, then press Enter. Or click a spot.',
  };
  const STATES: Record<string, string> = {
    sleep: 'asleep',
    wander: 'awake',
    meet: 'meeting',
    leave: 'leaving',
    away: 'away',
  };
  /** 'villager-3' reads as 'Villager 3'. */
  const nameOf = (id: string): string => (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, ' ');

  let sceneEl: HTMLElement;
  let trayEl: HTMLElement | undefined = $state();
  let index = $state(0);
  let tools: Verb[] = $state([]);
  let tool: Verb | null = $state(null);
  /** The last few story lines, hints, and results; new ones are announced. */
  let lines: { id: number; text: string }[] = $state([]);
  let lineId = 0;
  function say(text: string): void {
    lines = [...lines.slice(-2), { id: (lineId += 1), text }];
  }
  let bet: { question: string; options: string[] } | null = $state(null);
  let betRunning = $state(false);
  let reveal: { answer: string; result: string } | null = $state(null);
  let picked: string | null = $state(null);
  let pickedState = $state('');
  let cursor = $state({ x: 0, y: 0 });
  let ghost = $state(false);
  let speedNow = $state(0);
  let ended: 'done' | 'failed' | null = $state(null);

  let stage: Stage | null = null;
  let runner: ChapterRunner | null = null;
  let prev: WorldLite | null = null;
  let next: WorldLite | null = null;
  let prevAt = 0;
  let nextAt = 0;
  let raf: number | null = null;
  let hidden = false;
  let resumeSpeed = 1;
  let unpauseSpeed = 1;

  // The service never changes, so these are made once.
  const hints = untrack(() => game.input.createHints());
  const overPoke = untrack(() => game.input.createOverPoke());

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
        ? `Picked: ${nameOf(picked)}${pickedState ? `, ${pickedState}` : ''}`
        : '',
  );

  function act(v: VerbInput): void {
    hints.activity();
    if (!runner) return;
    runner.verb(v);
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
    else if (p.kind === 'bet') {
      reveal = null;
      bet = { question: p.question, options: p.options };
    } else {
      betRunning = false;
      reveal = { answer: p.answer, result: p.result };
      say(`Your guess: ${nameOf(p.answer)}. The answer: ${nameOf(p.result)}.`);
    }
  }

  function answer(option: string): void {
    hints.activity();
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
    prev = next = null;
    tools = chapter.verbs.filter((v) => v !== 'bet').slice(0, 3);
    const verb = chapter.newVerb;
    tool = verb !== null && tools.includes(verb) ? verb : (tools[0] ?? null);
    cursor = stage.benchSpots[0] ?? { x: 0, y: 0 };
    stage.setShot(null);
    // The accent rule: Pim in chapters 0 and 1, whose beats are all about Pim; no focus after.
    stage.setFocus(i <= 1 ? 'pim' : null);
    if (verb !== null && verb !== 'bet' && chapter.verbs.includes(verb)) hints.unlock(verb);

    const r = game.startChapter(chapter, flags);
    runner = r;
    r.onPrompt(onPrompt);
    r.onCamera((shot) => stage?.setShot(shot));
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

  /** No time passes unseen: a hidden tab pauses the sim and the frame loop. */
  function onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      if (hidden) return;
      hidden = true;
      resumeSpeed = game.currentSpeed();
      game.speed(0);
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    } else if (hidden) {
      hidden = false;
      game.speed(resumeSpeed);
      if (stage && raf === null) raf = requestAnimationFrame(frame);
    }
  }

  function onSceneKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') trayEl?.querySelector('button')?.focus();
  }

  onMount(() => {
    const offs: (() => void)[] = [];
    let gone = false;
    const activity = (): void => {
      hints.activity();
    };
    window.addEventListener('keydown', activity);
    window.addEventListener('pointerdown', activity);
    document.addEventListener('visibilitychange', onVisibility);
    hints.onHint((v) => {
      say(HINTS[v]);
      ghost = true;
      setTimeout(() => (ghost = false), 4000);
    });
    offs.push(
      game.onSnapshot((lite) => {
        prev = next ?? lite;
        next = lite;
        prevAt = nextAt;
        nextAt = performance.now();
        if (picked !== null)
          pickedState = STATES[lite.creatures.find((c) => c.id === picked)?.state ?? ''] ?? '';
      }),
    );

    void game.createStage(sceneEl).then((s) => {
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
        act,
        togglePause,
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
      begin(game.firstChapter, game.defaultFlags);
      sceneEl.focus();
      if (hidden) {
        resumeSpeed = game.currentSpeed();
        game.speed(0);
      } else {
        raf = requestAnimationFrame(frame);
      }
    });

    return () => {
      gone = true;
      runner = null;
      if (raf !== null) cancelAnimationFrame(raf);
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
        {ended === 'done' ? 'End of the first spring' : 'This chapter stopped'}
      </h1>
      <p>
        {ended === 'done'
          ? 'Chapters 0 to 3 are done. That is all of this slice for now.'
          : 'Something in the chapter content went wrong.'}
      </p>
      <button type="button" onclick={onExit}>Back to title</button>
    </main>
  {:else}
    <main class="hud" inert={bet !== null}>
      <h1 class="title">Chapter {index}</h1>
      <div class="bottom">
        <BeatLine {lines} />
        {#if reveal}
          <section class="reveal" aria-labelledby="reveal-title">
            <h2 id="reveal-title">Bet result</h2>
            <p>Your guess: {nameOf(reveal.answer)}. The answer: {nameOf(reveal.result)}.</p>
            <button
              type="button"
              onclick={() => {
                reveal = null;
                sceneEl.focus();
              }}>OK</button
            >
          </section>
        {/if}
        {#if status}<p class="status">{status}</p>{/if}
        <div class="tray" bind:this={trayEl}>
          {#if ghost}<span class="ghost" aria-hidden="true"></span>{/if}
          <ToolTray
            {tools}
            active={tool}
            onPick={(v: Verb) => {
              hints.activity();
              tool = v;
            }}
            onReply={(reply: BidReply) => {
              act({ verb: 'respond', reply });
            }}
          />
        </div>
        <ChapterRibbon count={game.chapters.length} current={index} onSkip={() => runner?.skip()} />
      </div>
      <div class="time">
        <TimeControls speed={speedNow} disabled={betRunning} onPause={togglePause} onSpeed={setSpeed} />
      </div>
    </main>
    {#if bet}
      <BetCard question={bet.question} options={bet.options} label={nameOf} onAnswer={answer} />
    {/if}
  {/if}
</div>

<style>
  .game {
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
  .hud .reveal {
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
  .tray {
    position: relative;
  }
  .reveal {
    padding: 0.75rem 1rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
    text-align: center;
  }
  .reveal h2 {
    margin: 0;
    font-size: 1.1rem;
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
  /* The ghost hand: a faint pointer over the first tool, shown once per new verb. */
  .ghost {
    position: absolute;
    left: 1rem;
    top: -1.5rem;
    width: 1.25rem;
    height: 1.25rem;
    border: 3px solid var(--muted);
    border-radius: 50% 50% 50% 0;
    opacity: 0.6;
    animation: tap 1.2s ease-in-out 3;
  }
  :global(:root[data-motion='reduced']) .ghost {
    animation: none;
  }
  @keyframes tap {
    50% {
      transform: translateY(0.75rem);
    }
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
