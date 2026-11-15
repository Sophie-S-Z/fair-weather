<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { InputContext } from '../../input/keyboard.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { Command, Season } from '../../sim/types.ts';
  import type { ChallengeId, ChallengeState } from '../../story/challenges.ts';
  import { displayName } from '../../story/names.ts';
  import { KNOBS, SANDBOX_TICKS_PER_DAY, SANDBOX_TOOLS, TOOL_PANEL } from '../../story/sandbox.ts';
  import type {
    Knob,
    KnobId,
    Panel,
    SandboxRunner,
    SandboxSetup,
    SandboxTool,
    SandboxValley,
    Switches,
  } from '../../story/sandbox.ts';
  import type { Verb, VerbInput } from '../../story/verbs.ts';
  import ChallengeCard from '../components/ChallengeCard.svelte';
  import SandboxPanel from '../components/SandboxPanel.svelte';
  import TimeControls from '../components/TimeControls.svelte';
  import TimelineStrip from '../components/TimelineStrip.svelte';
  import WhisperCard from '../components/WhisperCard.svelte';
  import { createFrameLoop } from '../frame-loop.ts';
  import type { GameService, Stage } from '../game-service.ts';
  import {
    byId,
    clampToScene,
    createPauseToggle,
    nearestCreature,
    spotLine,
    spotName as nearestSpot,
    whisperOthers,
  } from '../scene-helpers.ts';
  import type { Settings } from '../settings.ts';

  let {
    game,
    settings,
    status,
    openNew,
    onExit,
  }: {
    game: GameService;
    settings: Writable<Settings>;
    /** What the start choice offers (ADR 0014 item 1). */
    status: { kith: boolean; valleys: readonly SandboxValley[] };
    /** Opens a new Kith valley at once, without the start choice (dev ?sandbox=new). */
    openNew: boolean;
    onExit: () => void;
  } = $props();

  const PANEL_TITLES: Record<Panel, string> = {
    population: 'Population',
    rules: 'Rules',
    weather: 'Weather',
    network: 'Network',
  };
  const TOOL_LABELS: Record<SandboxTool, string> = {
    place: 'Place',
    path: 'Paths',
    shine: 'Sunlight',
    fog: 'Fog',
    blow: 'Wind',
    rain: 'Rain',
    thread: 'Thread',
    whisper: 'Whisper',
  };
  type PlaceKind = Extract<Command, { t: 'place' }>['kind'];
  const PLACE_KINDS: { kind: PlaceKind; label: string }[] = [
    { kind: 'bench', label: 'Bench' },
    { kind: 'bush', label: 'Berry bush' },
    { kind: 'bridge', label: 'Bridge' },
    { kind: 'lantern', label: 'Lantern' },
  ];
  const SWITCHES: { key: keyof Switches; label: string }[] = [
    { key: 'oneWay', label: 'One-way ties' },
    { key: 'weighted', label: 'Weighted ties' },
    { key: 'mixed', label: 'Mixed thresholds' },
    { key: 'drift', label: 'Rumors that change as they travel' },
  ];
  /** The tools that act at the cursor, which the Meadow draws. */
  const POINT_TOOLS: ReadonlySet<SandboxTool> = new Set(['place', 'path', 'shine', 'fog', 'blow', 'rain']);
  /** How near the cursor a creature is named in the status line, in scene units, as on the game screen. */
  const NEAR = 40;

  let sceneEl: HTMLElement;
  /** The setup of the run now; null while the start choice shows. */
  let setup = $state.raw<SandboxSetup | null>(null);
  let runner: SandboxRunner | null = null;
  let stage: Stage | null = $state.raw(null);
  let stageReady: Promise<Stage> | null = null;
  /** The newest snapshot of the run now, which the tools act on. */
  let next: WorldLite | null = null;
  /** The palette drawn now: in Kith the season's, in a valley its own (spec 7.3). */
  let paletteNow: string | null = null;
  let tool = $state<SandboxTool>('place');
  let placeKind = $state<PlaceKind>('bench');
  let gateLit = $state(true);
  let cursor = $state({ x: 0, y: 0 });
  let picked: string | null = $state(null);
  let nearby: string | null = $state(null);
  let threadFrom: string | null = $state(null);
  let pathFrom: { x: number; y: number } | null = $state(null);
  let whisperCard: { target: string; others: string[] } | null = $state(null);
  let speedNow = $state(0);
  /** Why the last start failed, shown in the status region until the player's next verb or start; null when none. */
  let notice: string | null = $state(null);
  /** A start waits for its first snapshot: one start at a time, so the controls that start one are off. */
  let starting = $state(false);
  /** A start failed in the worker, so no run goes on until the title starts the worker again. */
  let dead = $state(false);
  const locked = $derived(starting || dead);
  /** This run's timeline, and the tick of the snapshot drawn now, as the strip shows them. */
  let timeline: ReturnType<Stage['timeline']> = $state.raw({ points: [], breaks: [] });
  let drawnTick = $state(0);
  let liveTick = 0;
  let drawn: WorldLite | null = null;
  /**
   * The tick the strip asks for, or null for now; the rewound world once it arrives. While rewound
   * the sim is paused, and the tools, the pause, and Start the dance wait for Back to now. A rewind
   * during a challenge changes nothing in it: its check reads only live snapshots, so a challenge
   * that passed or failed stays so, and only Try again or Stop the challenge starts it again.
   */
  let rewindAt: number | null = $state(null);
  let rewound: WorldLite | null = $state.raw(null);
  /** Only the newest rewind request is drawn. */
  let rewindRequest = 0;
  let speedBeforeRewind = 1;
  let notes: readonly { tick: number; text: string }[] = $state.raw([]);
  let challengeState: ChallengeState | null = $state(null);
  let season: Season = $state('spring');
  let danced = $state(false);
  /** Counts starts, so only the newest one plays. */
  let runs = 0;
  let gone = false;

  const valleyChapter = (v: SandboxValley) => game.chapters.find((c) => c.id === v);
  const valleyName = $derived(
    !setup
      ? ''
      : setup.valley === 'kith'
        ? setup.kith
          ? 'Your Kith'
          : 'A new valley'
        : (valleyChapter(setup.valley)?.title ?? setup.valley),
  );
  const pointing = $derived(POINT_TOOLS.has(tool));
  /** The tool, and what it would act on: the cursor's nearest spot and creature, or the picked creature; then a mark. */
  const statusLine = $derived(
    [
      `Tool: ${TOOL_LABELS[tool]}`,
      pointing
        ? spotLine(spotName(cursor), nearby === null ? null : displayName(nearby))
        : picked
          ? `Picked: ${displayName(picked)}`
          : '',
      tool === 'path' && pathFrom ? `Path from ${spotName(pathFrom)}` : '',
      tool === 'thread' && threadFrom ? `Thread from ${displayName(threadFrom)}` : '',
      rewindAt === null ? '' : 'Rewound: the tools wait for Back to now',
    ]
      .filter((part) => part !== '')
      .join('. '),
  );
  /** A knob's step index in the setup now: the one set, or the one nearest its value when unset. */
  const stepOf = (k: Knob): number => setup?.knobs[k.id] ?? Math.round((k.unset * 100 - k.low) / k.step);
  /** Each panel's knobs for this valley, with their step index now and why one is off. */
  const knobsOf = (panel: Panel) =>
    KNOBS.filter((k) => k.panel === panel && (k.valley === null || k.valley === setup?.valley)).map((k) => {
      return {
        knob: k,
        index: stepOf(k),
        max: k.steps === 'benchSpots' ? (stage?.benchSpots.length ?? 0) : k.steps,
        why:
          k.id === 'gossipThreshold' && setup?.switches.mixed !== false
            ? 'Turn off Mixed thresholds to give all creatures one threshold.'
            : null,
      };
    });
  const toolsOf = (panel: Panel) =>
    SANDBOX_TOOLS.flatMap((t, i) =>
      TOOL_PANEL[t] === panel ? [{ tool: t, key: i + 1, label: TOOL_LABELS[t] }] : [],
    );

  /** The nearest bench spot's name: the spot words a screen reader hears for the cursor. */
  function spotName(p: { x: number; y: number }): string {
    return nearestSpot(stage?.benchSpots ?? [], p);
  }
  function nearbyAt(p: { x: number; y: number }): string | null {
    return nearestCreature(next?.creatures ?? [], p, NEAR);
  }

  const loop = createFrameLoop(
    (from, to, alpha) => {
      speedNow = game.currentSpeed();
      if (!stage) return;
      if (rewound) {
        stage.draw(rewound, rewound, 1, $settings);
        return;
      }
      if (drawn !== to) {
        drawn = to;
        drawnTick = liveTick;
        timeline = stage.timeline();
      }
      stage.draw(from, to, alpha, $settings);
    },
    () => performance.now(),
  );

  function setSpeed(m: number): void {
    game.speed(m);
    speedNow = m;
  }
  const pause = createPauseToggle(() => game.currentSpeed(), setSpeed);
  function togglePause(): void {
    if (rewindAt === null) pause();
  }

  /** Pauses the sim on the first move of the strip, and asks for the world at `t`. */
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
      () => undefined, // the worker restarted; the strip asks again on its next move
    );
  }
  function backToNow(): void {
    if (rewindAt === null) return;
    rewindAt = null;
    rewound = null;
    rewindRequest += 1;
    setSpeed(speedBeforeRewind);
  }
  function pin(t: number, text: string): void {
    game.sandbox.pin(t, text);
    notes = game.sandbox.notes();
  }

  /**
   * Starts a run of `s` from day 0; the run before stops once it has started. When the start fails,
   * `undo` puts the control back to the setup's value, and the status region says so. `from` is the
   * control that asked, which gets the focus back if it lost it while it was off.
   */
  async function run(s: SandboxSetup, undo?: () => void, from?: HTMLElement): Promise<void> {
    const token = (runs += 1);
    notice = null;
    starting = true;
    let r: SandboxRunner | null = null;
    try {
      r = await game.sandbox.start(s);
    } catch (e) {
      // Ids only, for whoever reads the console.
      console.error(e);
    }
    if (token !== runs || gone) return;
    starting = false;
    if (!r) {
      undo?.();
      dead = game.sandbox.workerFailed();
      if (dead) {
        // No run goes on: the title starts the worker again.
        loop.stop();
        runner = null;
      }
      notice = dead
        ? 'The valley could not start again. The rules did not change. Go back to the title to try again.'
        : 'The valley could not start again. The rules did not change.';
    }
    await tick();
    // A control that lost the focus while it was off gets it back; when it stays off, Back to title gets it.
    if (document.activeElement === document.body)
      (dead ? document.querySelector<HTMLElement>('.top button') : from)?.focus();
    if (!r) return;
    loop.stop();
    if (stage && s.valley !== setup?.valley) {
      stage.setScene(game.sandbox.scene(s.valley));
      cursor = stage.benchSpots[0] ?? { x: 0, y: 0 };
    }
    next = null;
    drawn = null;
    rewindAt = null;
    rewound = null;
    rewindRequest += 1;
    notes = game.sandbox.notes();
    challengeState = r.challenge();
    r.onChallenge((st) => (challengeState = st));
    danced = false;
    runner = r;
    setup = s;
    r.setPlaceKind(placeKind);
    gateLit = true;
    threadFrom = null;
    pathFrom = null;
    whisperCard = null;
    speedNow = game.currentSpeed();
    loop.start();
  }

  /**
   * A knob or a switch changed: the run starts again from day 0, keeping what the player placed
   * (ADR 0014 item 2). `undo` puts the control back when the start fails.
   */
  function restart(
    change: Pick<SandboxSetup, 'knobs'> | Pick<SandboxSetup, 'switches'>,
    undo: () => void,
    from: HTMLElement,
  ): void {
    if (!setup) return;
    void run(
      {
        ...setup,
        ...change,
        structures: game.sandbox.placedStructures(),
        bushes: game.sandbox.placedBushes(),
      },
      undo,
      from,
    );
  }
  function setKnob(id: KnobId, index: number, input: HTMLInputElement): void {
    if (!setup) return;
    const knob = KNOBS.find((k) => k.id === id);
    const before = knob ? stepOf(knob) : index;
    restart(
      { knobs: { ...setup.knobs, [id]: index } },
      () => {
        // The range is bound one way to the setup's step, which did not change, so it is put back here.
        input.value = String(before);
      },
      input,
    );
  }
  function setSwitch(key: keyof Switches, input: HTMLInputElement): void {
    if (!setup) return;
    const before = setup.switches[key];
    restart(
      { switches: { ...setup.switches, [key]: input.checked } },
      () => {
        input.checked = before;
      },
      input,
    );
  }

  /** Opens a valley from the start choice: the gate's lamp, then the run (its scene comes with it, the palette with its first snapshot). */
  async function choose(valley: SandboxValley, fromKith: boolean): Promise<void> {
    const [s, st] = await Promise.all([game.sandbox.newSetup(valley, fromKith), stageReady]);
    if (!st || gone) return;
    st.setGateLamp(true);
    await run(s);
    await tick();
    // After a failed start the choice stays, with its enabled buttons (Back to title at least).
    if (setup) sceneEl.focus();
    else document.querySelector<HTMLElement>('.choice button:enabled')?.focus();
  }

  /**
   * Starts `s` from the card, and then gives the focus to the card's first control on, since the
   * one pressed went away or was off while the start waited.
   */
  async function runFromCard(s: SandboxSetup): Promise<void> {
    await run(s);
    await tick();
    if (document.activeElement === document.body)
      document.querySelector<HTMLElement>('.challenges button:enabled')?.focus();
  }
  /**
   * A challenge starts from a new Kith of this seed, with the player's knobs and switches, nothing
   * placed, and its own start (ADR 0014 item 6). A knob of another valley does not go with it.
   */
  function pickChallenge(id: ChallengeId | null): void {
    if (!setup) return;
    const valley: SandboxValley = 'kith';
    const knobs: SandboxSetup['knobs'] = {};
    for (const k of KNOBS) {
      const index = setup.knobs[k.id];
      if (index !== undefined && (k.valley === null || k.valley === valley)) knobs[k.id] = index;
    }
    void runFromCard({ ...setup, valley, kith: null, challenge: id, knobs, structures: [], bushes: [] });
  }
  function dance(): void {
    if (rewindAt === null && runner?.startDance()) danced = true;
  }

  /** Uses a verb on the run; with a run going on, the player's verb also ends a failed start's notice. */
  function verb(v: VerbInput): boolean {
    if (!runner || rewindAt !== null) return false;
    notice = null;
    return runner.verb(v);
  }
  function act(v: VerbInput): void {
    verb(v);
  }
  function setGate(e: Event & { currentTarget: HTMLInputElement }): void {
    const on = e.currentTarget.checked;
    if (verb({ verb: 'welcome', on })) gateLit = on;
    else e.currentTarget.checked = gateLit;
  }
  function pickTool(t: SandboxTool): void {
    tool = t;
  }
  function setPlaceKind(kind: PlaceKind): void {
    placeKind = kind;
    runner?.setPlaceKind(kind);
  }

  /** Opens the whisper card for `target`, about every other named creature not gone, in id order. */
  function openWhisper(target: string): void {
    if (rewindAt !== null) return;
    whisperCard = { target, others: whisperOthers(next?.creatures ?? [], target, game.castIds) };
  }
  function whisper(about: string, sign: 1 | -1): void {
    const card = whisperCard;
    whisperCard = null;
    if (card) act({ verb: 'whisper', target: card.target, about, sign });
  }

  /** Escape moves to the panels, unless the keyboard took it to let go of a mark or a path start. */
  function onSceneKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !e.defaultPrevented)
      document.querySelector<HTMLElement>('.panels summary')?.focus();
  }

  // The Meadow draws the cursor while a tool acts at it.
  $effect(() => {
    stage?.setCursor(setup && pointing ? { x: cursor.x, y: cursor.y } : null);
  });

  onMount(() => {
    const offs: (() => void)[] = [];
    offs.push(
      game.onSnapshot((lite, at) => {
        season = lite.season;
        if (!runner || !stage || !setup) return;
        stage.snapshot(at, lite);
        liveTick = at;
        next = lite;
        loop.push(lite);
        nearby = nearbyAt(cursor);
        const valley = valleyChapter(setup.valley);
        const palette = valley ? (valley.palette ?? valley.season) : lite.season;
        if (palette !== paletteNow) {
          stage.setPalette(palette);
          paletteNow = palette;
        }
      }),
    );
    stageReady = game.createStage(sceneEl).then((s) => {
      if (gone) {
        s.destroy();
        return s;
      }
      stage = s;
      const ctx: InputContext = {
        tools: () => SANDBOX_TOOLS,
        creatures: () => [...(next?.creatures ?? [])].sort(byId),
        // A bench goes at the cursor in the sandbox, not at the nearest bench spot.
        benchSpots: () => [],
        placeKind: () => placeKind,
        water: () => next?.water ?? [],
        cursor: () => cursor,
        tool: () => tool,
        setTool: (v: Verb) => {
          const t = SANDBOX_TOOLS.find((x) => x === v);
          if (t) tool = t;
        },
        reply: () => 'toward',
        setReply: () => undefined,
        act,
        togglePause,
        picked: () => picked,
        select: (id) => (picked = id),
        moveCursor: (p) => {
          cursor = clampToScene(p, s.sceneSize);
          nearby = nearbyAt(cursor);
        },
        view: () => 'meadow',
        zoom: () => undefined,
        isFriend: (a, b) => next !== null && game.isFriend(next, a, b),
        threadFrom: () => threadFrom,
        setThreadFrom: (id) => (threadFrom = id),
        pathFrom: () => pathFrom,
        setPathFrom: (p) => (pathFrom = p),
        openWhisper,
        manner: () => ({ reply: 'toward', gift: 'give' }),
        heroKind: () => null,
        heroBerries: () => 0,
        heroFlying: () => false,
        keepsakes: () => [],
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
      return s;
    });
    if (untrack(() => openNew)) void choose('kith', false);
    else document.querySelector<HTMLElement>('.choice button')?.focus();
    return () => {
      gone = true;
      for (const off of offs) off();
      loop.stop();
      game.sandbox.stop();
      stage?.setGateLamp(false);
      stage?.destroy();
    };
  });
</script>

<div class="sandbox">
  <div class="layer" inert={whisperCard !== null || setup === null}>
    <!-- The scene is a keyboard surface (spec 12.5), as on the game screen. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="scene"
      role="application"
      aria-label="The sandbox valley"
      aria-describedby="sandbox-help"
      tabindex="0"
      bind:this={sceneEl}
      onkeydown={onSceneKey}
    ></div>
    <p id="sandbox-help" class="sr-only">
      Keys 1 to 8 pick a tool. The arrow keys move the spot, and Tab picks a creature. Enter uses the tool.
      With Paths, Enter sets the start of a path, and Enter again sets its end. Space pauses, and Escape moves
      to the panels.
    </p>
    {#if setup}
      <main class="hud">
        <div class="top">
          <h1 class="title">Sandbox: {valleyName}</h1>
          <button type="button" onclick={onExit}>Back to title</button>
        </div>
        <div class="panels">
          <SandboxPanel
            title={PANEL_TITLES.population}
            knobs={knobsOf('population')}
            onKnob={setKnob}
            {locked}
            tools={toolsOf('population')}
            {tool}
            onTool={pickTool}
          >
            <fieldset class="choices">
              <legend>What to place</legend>
              {#each PLACE_KINDS as p (p.kind)}
                <label class="choice-row">
                  <input
                    type="radio"
                    name="place-kind"
                    checked={placeKind === p.kind}
                    onchange={() => {
                      setPlaceKind(p.kind);
                    }}
                  />
                  {p.label}
                </label>
              {/each}
            </fieldset>
            <label class="choice-row">
              <input type="checkbox" checked={gateLit} onchange={setGate} />
              Light the gate for newcomers
            </label>
          </SandboxPanel>
          <SandboxPanel
            title={PANEL_TITLES.rules}
            knobs={knobsOf('rules')}
            onKnob={setKnob}
            {locked}
            tools={[]}
            {tool}
            onTool={pickTool}
          >
            <p class="line">When you change a rule, the valley starts again from its first day.</p>
          </SandboxPanel>
          <SandboxPanel
            title={PANEL_TITLES.weather}
            knobs={knobsOf('weather')}
            onKnob={setKnob}
            {locked}
            tools={toolsOf('weather')}
            {tool}
            onTool={pickTool}
          />
          <SandboxPanel
            title={PANEL_TITLES.network}
            knobs={knobsOf('network')}
            onKnob={setKnob}
            {locked}
            tools={toolsOf('network')}
            {tool}
            onTool={pickTool}
          >
            {#each SWITCHES as sw (sw.key)}
              <label class="choice-row">
                <input
                  type="checkbox"
                  checked={setup.switches[sw.key]}
                  disabled={locked}
                  onchange={(e) => {
                    setSwitch(sw.key, e.currentTarget);
                  }}
                />
                {sw.label}
              </label>
            {/each}
          </SandboxPanel>
        </div>
        <section class="timeline" aria-labelledby="timeline-title">
          <h2 id="timeline-title">Timeline</h2>
          <TimelineStrip
            {timeline}
            rewind={{ now: drawnTick, at: rewindAt, ticksPerDay: SANDBOX_TICKS_PER_DAY, disabled: locked }}
            onRewind={rewindTo}
            onBackToNow={backToNow}
            {notes}
            onPin={pin}
          />
        </section>
        <div class="challenges">
          <ChallengeCard
            challenge={setup.challenge}
            state={challengeState}
            {season}
            canDance={!danced && rewindAt === null && !locked}
            {locked}
            onPick={pickChallenge}
            onDance={dance}
            onTryAgain={() => {
              if (setup) void runFromCard({ ...setup, structures: [], bushes: [] });
            }}
            onStop={() => {
              pickChallenge(null);
            }}
          />
        </div>
        <div class="time">
          <TimeControls
            speed={speedNow}
            disabled={rewindAt !== null}
            onPause={togglePause}
            onSpeed={setSpeed}
          />
        </div>
      </main>
    {/if}
  </div>
  {#if setup === null}
    <main class="choice">
      <h1>Sandbox</h1>
      <p>Choose a valley to start from.</p>
      <div class="start-from" role="group" aria-label="Start from">
        {#if status.kith}
          <button type="button" disabled={locked} onclick={() => void choose('kith', true)}>Your Kith</button>
        {/if}
        <button type="button" disabled={locked} onclick={() => void choose('kith', false)}
          >A new valley</button
        >
        {#each status.valleys as v (v)}
          <button type="button" disabled={locked} onclick={() => void choose(v, false)}
            >{valleyChapter(v)?.title ?? v}</button
          >
        {/each}
      </div>
      <button type="button" onclick={onExit}>Back to title</button>
    </main>
  {:else if whisperCard}
    <WhisperCard
      target={whisperCard.target}
      others={whisperCard.others}
      label={displayName}
      onWhisper={whisper}
      onCancel={() => (whisperCard = null)}
    />
  {/if}
  <!-- Always here, so a failed first start, from the start choice, is said too. -->
  <p class="status" role="status">{notice ?? (setup ? statusLine : '')}</p>
</div>

<style>
  .sandbox,
  .layer {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .scene {
    position: absolute;
    inset: 0;
    /* Drags are the game's, not the browser's. */
    touch-action: none;
  }
  .scene:focus-visible {
    outline-offset: -6px;
  }
  .hud {
    pointer-events: none;
  }
  .hud .top,
  .hud .panels,
  .hud .timeline,
  .hud .challenges,
  .hud .time {
    pointer-events: auto;
  }
  .top {
    position: absolute;
    top: 0.5rem;
    left: 0.75rem;
    right: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }
  .title {
    margin: 0;
    padding: 0.1rem 0.5rem;
    font-size: 1rem;
    background: var(--bg);
  }
  .panels {
    position: absolute;
    top: 3.75rem;
    left: 0.75rem;
    bottom: 4rem;
    width: min(20rem, calc(100vw - 1.5rem));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }
  .line {
    margin: 0;
  }
  /* Under the scene, between the panels and the time controls. */
  .timeline {
    position: absolute;
    left: calc(min(20rem, 100vw - 1.5rem) + 1.5rem);
    right: 12rem;
    bottom: 3rem;
    max-height: 40vh;
    overflow-y: auto;
    padding: 0.5rem 0.75rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  .timeline h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .challenges {
    position: absolute;
    top: 3.75rem;
    right: 0.75rem;
    width: min(18rem, calc(100vw - 1.5rem));
    max-height: calc(100vh - 18rem);
    overflow-y: auto;
  }
  /*
   * On a narrow screen the folded card takes a row above the panels, and the strip the width under
   * them; the panels keep clear of both.
   */
  @media (max-width: 48rem) {
    .challenges {
      left: 0.75rem;
      width: auto;
    }
    .timeline {
      left: 0.75rem;
      right: 0.75rem;
      bottom: 6.5rem;
      max-height: 30vh;
    }
    .panels {
      top: 7.5rem;
      bottom: calc(30vh + 7rem);
    }
  }
  .status {
    pointer-events: none;
    position: absolute;
    left: 50%;
    bottom: 0.75rem;
    transform: translateX(-50%);
    margin: 0;
    padding: 0 0.5rem;
    background: var(--bg);
  }
  .time {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
  }
  .choice {
    position: fixed;
    inset: 0;
    padding: 2rem max(1rem, calc((100vw - 30rem) / 2));
    overflow-y: auto;
    background: var(--bg);
  }
  .start-from {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
</style>
