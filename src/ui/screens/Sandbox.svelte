<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { InputContext } from '../../input/keyboard.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { Command } from '../../sim/types.ts';
  import { displayName } from '../../story/names.ts';
  import { KNOBS, SANDBOX_TOOLS, TOOL_PANEL } from '../../story/sandbox.ts';
  import type {
    KnobId,
    Panel,
    SandboxRunner,
    SandboxSetup,
    SandboxTool,
    SandboxValley,
    Switches,
  } from '../../story/sandbox.ts';
  import type { Verb, VerbInput } from '../../story/verbs.ts';
  import SandboxPanel from '../components/SandboxPanel.svelte';
  import TimeControls from '../components/TimeControls.svelte';
  import WhisperCard from '../components/WhisperCard.svelte';
  import { createFrameLoop } from '../frame-loop.ts';
  import type { GameService, Stage } from '../game-service.ts';
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
  let unpauseSpeed = 1;
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
        ? `Spot near: ${spotName(cursor)}${nearby === null ? '' : `, by ${displayName(nearby)}`}`
        : picked
          ? `Picked: ${displayName(picked)}`
          : '',
      tool === 'path' && pathFrom ? `Path from ${spotName(pathFrom)}` : '',
      tool === 'thread' && threadFrom ? `Thread from ${displayName(threadFrom)}` : '',
    ]
      .filter((part) => part !== '')
      .join('. '),
  );
  /** Each panel's knobs for this valley, with their step index now and why one is off. */
  const knobsOf = (panel: Panel) =>
    KNOBS.filter((k) => k.panel === panel && (k.valley === null || k.valley === setup?.valley)).map((k) => {
      const set = setup?.knobs[k.id];
      return {
        knob: k,
        index: set ?? Math.round((k.unset * 100 - k.low) / k.step),
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
    let best = '';
    let bestD = Infinity;
    for (const s of stage?.benchSpots ?? []) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = s.id.replace(/-/g, ' ');
      }
    }
    return best;
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

  const loop = createFrameLoop(
    (from, to, alpha) => {
      speedNow = game.currentSpeed();
      stage?.draw(from, to, alpha, $settings);
    },
    () => performance.now(),
  );

  function setSpeed(m: number): void {
    game.speed(m);
    speedNow = m;
  }
  function togglePause(): void {
    const now = game.currentSpeed();
    if (now > 0) {
      unpauseSpeed = now;
      setSpeed(0);
    } else setSpeed(unpauseSpeed);
  }

  /** Starts a run of `s` from day 0; the run before stops once it has started. */
  async function run(s: SandboxSetup): Promise<void> {
    const token = (runs += 1);
    let r: SandboxRunner;
    try {
      r = await game.sandbox.start(s);
    } catch (e) {
      // A setup the sim cannot start: the run before goes on. Ids only, for whoever reads the console.
      console.error(e);
      return;
    }
    if (token !== runs || gone) return;
    loop.stop();
    next = null;
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

  /** A knob or a switch changed: the run starts again from day 0, keeping what the player placed (ADR 0014 item 2). */
  function restart(change: Pick<SandboxSetup, 'knobs'> | Pick<SandboxSetup, 'switches'>): void {
    if (!setup) return;
    void run({
      ...setup,
      ...change,
      structures: game.sandbox.placedStructures(),
      bushes: game.sandbox.placedBushes(),
    });
  }
  function setKnob(id: KnobId, index: number): void {
    if (setup) restart({ knobs: { ...setup.knobs, [id]: index } });
  }
  function setSwitch(key: keyof Switches, on: boolean): void {
    if (setup) restart({ switches: { ...setup.switches, [key]: on } });
  }

  /** Opens a valley from the start choice: its scene and the gate's lamp, then the run (the palette comes with its first snapshot). */
  async function choose(valley: SandboxValley, fromKith: boolean): Promise<void> {
    const [s, st] = await Promise.all([game.sandbox.newSetup(valley, fromKith), stageReady]);
    if (!st || gone) return;
    st.setScene(game.sandbox.scene(valley));
    st.setGateLamp(true);
    cursor = st.benchSpots[0] ?? { x: 0, y: 0 };
    await run(s);
    await tick();
    sceneEl.focus();
  }

  function act(v: VerbInput): void {
    runner?.verb(v);
  }
  function setGate(e: Event & { currentTarget: HTMLInputElement }): void {
    const on = e.currentTarget.checked;
    if (runner?.verb({ verb: 'welcome', on })) gateLit = on;
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
      game.onSnapshot((lite) => {
        if (!runner || !stage || !setup) return;
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
        creatures: () =>
          [...(next?.creatures ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
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
          const { width, height } = s.sceneSize;
          cursor = { x: Math.min(width, Math.max(0, p.x)), y: Math.min(height, Math.max(0, p.y)) };
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
            tools={toolsOf('population')}
            {tool}
            onTool={pickTool}
          >
            <fieldset>
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
            tools={toolsOf('weather')}
            {tool}
            onTool={pickTool}
          />
          <SandboxPanel
            title={PANEL_TITLES.network}
            knobs={knobsOf('network')}
            onKnob={setKnob}
            tools={toolsOf('network')}
            {tool}
            onTool={pickTool}
          >
            {#each SWITCHES as sw (sw.key)}
              <label class="choice-row">
                <input
                  type="checkbox"
                  checked={setup.switches[sw.key]}
                  onchange={(e) => {
                    setSwitch(sw.key, e.currentTarget.checked);
                  }}
                />
                {sw.label}
              </label>
            {/each}
          </SandboxPanel>
        </div>
        <p class="status" role="status">{statusLine}</p>
        <div class="time">
          <TimeControls speed={speedNow} disabled={false} onPause={togglePause} onSpeed={setSpeed} />
        </div>
      </main>
    {/if}
  </div>
  {#if setup === null}
    <main class="choice">
      <h1>Sandbox</h1>
      <p>Choose a valley to start from.</p>
      <div class="choices" role="group" aria-label="Start from">
        {#if status.kith}
          <button type="button" onclick={() => void choose('kith', true)}>Your Kith</button>
        {/if}
        <button type="button" onclick={() => void choose('kith', false)}>A new valley</button>
        {#each status.valleys as v (v)}
          <button type="button" onclick={() => void choose(v, false)}>{valleyChapter(v)?.title ?? v}</button>
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
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin: 0;
    padding: 0.25rem 0.5rem 0.5rem;
    border: 1px solid var(--muted);
    border-radius: 0.4rem;
  }
  .choice-row {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 1.75rem;
  }
  .line {
    margin: 0;
  }
  .status {
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
  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
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
