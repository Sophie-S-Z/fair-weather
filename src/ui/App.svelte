<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { Application } from 'pixi.js';
  import type { AudioEngine } from '../audio/engine.ts';
  import { loadFound, saveFound, type StickerStorage } from '../persist/stickers.ts';
  import type { Rig } from '../render/line/rig.ts';
  import type { Look, TableView } from '../render/table-view.ts';
  import { CAST } from '../toy/cast.ts';
  import {
    drop,
    moveHeld,
    moveProp,
    pickUp,
    placeProp,
    poke,
    removeProp,
    snip,
    tie,
    toggleProp,
  } from '../toy/commands.ts';
  import { heightOf } from '../toy/geometry.ts';
  import { neighbors } from '../toy/table.ts';
  import {
    STICKER_IDS,
    type Critter,
    type Prop,
    type PropKind,
    type StickerId,
    type Table,
  } from '../toy/types.ts';
  import type { Tool } from './art.ts';
  import Drawer from './Drawer.svelte';
  import { runFrames } from './frame.ts';
  import { PROP_BOX, PROP_NAMES } from './props.ts';
  import type { Settings } from './settings.ts';
  import SettingsDialog from './SettingsDialog.svelte';
  import StickerBook from './StickerBook.svelte';
  import StickerCard from './StickerCard.svelte';

  interface Props {
    app: Application;
    table: Table;
    view: TableView;
    rigs: ReadonlyMap<string, Rig>;
    settings: Writable<Settings>;
    audio: AudioEngine;
    storage: StickerStorage | null;
  }
  const { app, table, view, rigs, settings, audio, storage }: Props = $props();

  const initialFound = (): StickerId[] => loadFound(storage, STICKER_IDS);

  /** A press that moves less than this (pixels) is a poke, not a drag. */
  const DRAG_START = 6;
  /** Table units an arrow key moves a held creature or a prop. */
  const KEY_STEP = 30;

  let found = $state<StickerId[]>(initialFound());
  let fresh = $state<StickerId | null>(null);
  let line = $state('');
  let tool = $state<Tool>('hand');
  let firstPick = $state<string | null>(null);
  let pointer: [number, number] | null = null;
  let bookOpen = $state(false);
  let bookPage = $state<StickerId | null>(null);
  let settingsOpen = $state(false);
  let look = $state<Look>({ reducedMotion: false, highContrast: false });
  let critterHits = $state<{ id: string; label: string; box: [number, number, number, number] }[]>([]);
  let propHits = $state<{ kind: PropKind; label: string; box: [number, number, number, number] }[]>([]);
  let placed = $state<PropKind[]>([]);

  function nameOf(c: Critter): string {
    const t = CAST[c.cast];
    const state = c.held ? ', held' : c.stuck ? ', stuck in the puddle' : '';
    const friends = neighbors(table, c.id).map(
      (id) => CAST[table.critters.find((k) => k.id === id)?.cast ?? 'pim'].name,
    );
    return `${t.name}, ${t.about}${state}${friends.length > 0 ? `, tied to ${friends.join(' and ')}` : ''}`;
  }

  function placeOverlay(): void {
    const k = view.scale();
    critterHits = table.critters
      .filter((c) => !c.id.endsWith('+copy'))
      .map((c) => {
        const h = heightOf(c) * k;
        const w = Math.max(44, h * 0.8);
        const [x, y] = view.toScreen(c.x, c.y - (c.held ? 34 : 0));
        return { id: c.id, label: nameOf(c), box: [x - w / 2, y - h, w, Math.max(44, h)] };
      });
    propHits = table.props.map((p: Prop) => {
      const [ox, oy, w, h] = PROP_BOX[p.kind];
      const [x, y] = view.toScreen(p.x + ox, p.y + oy);
      return {
        kind: p.kind,
        label: PROP_NAMES[p.kind],
        box: [x, y, Math.max(44, w * k), Math.max(44, h * k)],
      };
    });
    placed = table.props.map((p) => p.kind);
  }

  function onEvents(events: typeof table.events): void {
    for (const e of events) {
      if (e.kind === 'chirp') audio.play({ kind: 'chirp', who: e.who, mood: e.mood });
      else if (e.kind === 'pop') audio.play({ kind: 'pop' });
      else if (e.kind === 'line') line = e.text;
      else if (!found.includes(e.id)) {
        found = STICKER_IDS.filter((id) => id === e.id || found.includes(id));
        saveFound(storage, found);
        fresh = e.id;
        audio.play({ kind: 'sticker' });
      }
    }
  }

  /** The part of the table the main view frames: the whole floor and a strip of sky. */
  const VIEW_RECT = { x: 50, y: 250, w: 1500, h: 630 };
  /** Pixels kept clear above the table for the title and the corner buttons. */
  const TOP_CLEAR = 80;
  let drawerHeight = $state(150);

  function fit(): void {
    view.fit(app.screen.width, app.screen.height, VIEW_RECT, { top: TOP_CLEAR, bottom: drawerHeight + 24 });
  }
  $effect(() => {
    fit();
  });

  let stop = (): void => undefined;
  let unsubscribe = (): void => undefined;
  onMount(() => {
    unsubscribe = settings.subscribe((s) => {
      look = { reducedMotion: s.reducedMotion, highContrast: s.highContrast };
      table.calm = s.reducedMotion;
      document.documentElement.style.setProperty('--text-scale', String(s.textScale));
      document.documentElement.dataset['contrast'] = s.highContrast ? 'high' : 'normal';
    });
    app.stage.addChild(view.container);
    fit();
    app.renderer.on('resize', fit);
    stop = runFrames(app.ticker, view, {
      table: () => table,
      look: () => look,
      events: onEvents,
      pending: () => (firstPick && pointer ? { from: firstPick, x: pointer[0], y: pointer[1] } : null),
      drawn: placeOverlay,
    });
  });
  onDestroy(() => {
    stop();
    unsubscribe();
    app.renderer.off('resize', fit);
  });

  // Pointer play on a creature: press and drag to carry, press and let go to poke.
  let press: { id: string; x: number; y: number; dragging: boolean; grip: [number, number] } | null = null;

  function pickTwo(id: string): void {
    if (!firstPick) {
      firstPick = id;
      return;
    }
    if (firstPick !== id) {
      if (tool === 'yarn') tie(table, firstPick, id);
      else snip(table, firstPick, id);
    }
    firstPick = null;
  }

  function critterDown(e: PointerEvent, id: string): void {
    if (tool !== 'hand') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    press = { id, x: e.clientX, y: e.clientY, dragging: false, grip: [0, 0] };
  }

  function critterMove(e: PointerEvent): void {
    if (!press) return;
    const [px, py] = view.toTable(e.clientX, e.clientY);
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_START) {
      const c = table.critters.find((k) => k.id === press?.id);
      press.dragging = c !== undefined && pickUp(table, press.id);
      if (!press.dragging || !c) {
        press = null;
        return;
      }
      press.grip = [c.x - px, c.y - py];
    }
    if (press.dragging) moveHeld(table, px + press.grip[0], py + press.grip[1]);
  }

  function critterUp(id: string): void {
    if (tool !== 'hand') {
      pickTwo(id);
      return;
    }
    if (press?.dragging) drop(table);
    else if (press) poke(table, id);
    press = null;
  }

  function critterKey(e: KeyboardEvent, id: string): void {
    const c = table.critters.find((k) => k.id === id);
    if (!c) return;
    if (tool !== 'hand') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickTwo(id);
      }
      return;
    }
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = arrows[e.key];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (c.held) drop(table);
      else pickUp(table, id);
    } else if (e.key === ' ') {
      e.preventDefault();
      poke(table, id);
    } else if (move && c.held) {
      e.preventDefault();
      moveHeld(table, c.x + move[0], c.y + move[1]);
    } else if (e.key === 'Escape' && c.held) {
      drop(table);
    }
  }

  let propPress: { kind: PropKind; x: number; y: number; dragging: boolean; from: [number, number] } | null =
    null;

  function propDown(e: PointerEvent, kind: PropKind): void {
    const p = table.props.find((q) => q.kind === kind);
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    propPress = { kind, x: e.clientX, y: e.clientY, dragging: false, from: [p.x, p.y] };
  }

  function propMove(e: PointerEvent): void {
    if (!propPress) return;
    if (Math.hypot(e.clientX - propPress.x, e.clientY - propPress.y) > DRAG_START) propPress.dragging = true;
    if (propPress.dragging) {
      const k = view.scale();
      moveProp(
        table,
        propPress.kind,
        propPress.from[0] + (e.clientX - propPress.x) / k,
        propPress.from[1] + (e.clientY - propPress.y) / k,
      );
    }
  }

  function propUp(): void {
    if (propPress && !propPress.dragging) toggleProp(table, propPress.kind);
    propPress = null;
  }

  function propKey(e: KeyboardEvent, kind: PropKind): void {
    const p = table.props.find((q) => q.kind === kind);
    if (!p) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = arrows[e.key];
    if (move) {
      e.preventDefault();
      moveProp(table, kind, p.x + move[0], p.y + move[1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleProp(table, kind);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      removeProp(table, kind);
    }
  }

  function trackPointer(e: PointerEvent): void {
    pointer = view.toTable(e.clientX, e.clientY);
  }

  function chooseTool(next: Tool): void {
    tool = next;
    firstPick = null;
  }

  function toggleDrawerProp(kind: PropKind): void {
    if (table.props.some((p) => p.kind === kind)) removeProp(table, kind);
    else placeProp(table, kind);
  }

  function startOver(): void {
    found = [];
    saveFound(storage, found);
  }

  const toolHint = $derived(
    tool === 'hand'
      ? ''
      : firstPick
        ? `Now pick a second creature to ${tool === 'yarn' ? 'tie to' : 'cut from'} ${CAST[table.critters.find((c) => c.id === firstPick)?.cast ?? 'pim'].name}.`
        : `Pick the first creature to ${tool === 'yarn' ? 'tie' : 'cut'}.`,
  );
</script>

<svelte:window onpointermove={trackPointer} />

<main aria-label="Toybox table">
  <div
    id="stage"
    {@attach (el: HTMLDivElement) => {
      el.appendChild(app.canvas);
    }}
    class:yarn={tool === 'yarn'}
    class:scissors={tool === 'scissors'}
  ></div>

  <div class="overlay">
    {#each propHits as p (p.kind)}
      <button
        class="hit prop"
        style:left="{p.box[0]}px"
        style:top="{p.box[1]}px"
        style:width="{p.box[2]}px"
        style:height="{p.box[3]}px"
        aria-label={p.label}
        onpointerdown={(e) => {
          propDown(e, p.kind);
        }}
        onpointermove={propMove}
        onpointerup={propUp}
        onkeydown={(e) => {
          propKey(e, p.kind);
        }}
      ></button>
    {/each}
    {#each critterHits as c (c.id)}
      <button
        class="hit creature"
        class:picked={firstPick === c.id}
        style:left="{c.box[0]}px"
        style:top="{c.box[1]}px"
        style:width="{c.box[2]}px"
        style:height="{c.box[3]}px"
        aria-label={c.label}
        onpointerdown={(e) => {
          critterDown(e, c.id);
        }}
        onpointermove={critterMove}
        onpointerup={() => {
          critterUp(c.id);
        }}
        onkeydown={(e) => {
          critterKey(e, c.id);
        }}
      ></button>
    {/each}
  </div>

  <header>
    <h1>Fair Weather</h1>
    <p>A toybox of small creatures and big ideas</p>
  </header>

  <nav class="corner" aria-label="Book and settings">
    <button
      class="cutout book"
      onclick={() => {
        bookPage = null;
        bookOpen = true;
      }}
    >
      Sticker book <span class="count">{found.length} of {STICKER_IDS.length}</span>
    </button>
    <button
      class="cutout"
      onclick={() => {
        settingsOpen = true;
      }}>Settings</button
    >
  </nav>

  {#if fresh}
    <StickerCard
      id={fresh}
      open={() => {
        bookPage = fresh;
        bookOpen = true;
        fresh = null;
      }}
      close={() => {
        fresh = null;
      }}
    />
  {/if}

  <Drawer
    {tool}
    {placed}
    {found}
    hint={toolHint}
    choose={chooseTool}
    toggle={toggleDrawerProp}
    bind:height={drawerHeight}
  />

  <p class="sr-only" aria-live="polite">{line}</p>
</main>

<StickerBook
  open={bookOpen}
  page={bookPage}
  {found}
  {rigs}
  {look}
  show={(id: StickerId | null) => {
    bookPage = id;
  }}
  close={() => {
    bookOpen = false;
  }}
  {startOver}
/>
<SettingsDialog
  open={settingsOpen}
  {settings}
  close={() => {
    settingsOpen = false;
  }}
/>

<style>
  #stage {
    position: fixed;
    inset: 0;
  }
  #stage :global(canvas) {
    display: block;
  }
  .overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }
  .hit {
    position: absolute;
    pointer-events: auto;
    background: transparent;
    border: 0;
    padding: 0;
    border-radius: 45%;
    cursor: grab;
    touch-action: none;
  }
  .hit:active {
    cursor: grabbing;
  }
  .hit:focus-visible {
    outline: 3px dashed var(--berry);
    outline-offset: 2px;
  }
  .yarn ~ .overlay .creature,
  .scissors ~ .overlay .creature {
    cursor: crosshair;
  }
  .picked {
    outline: 3px dashed var(--berry);
  }
  header {
    position: fixed;
    top: 1.25rem;
    left: 1.5rem;
    pointer-events: none;
  }
  h1 {
    font-size: 2.1rem;
    letter-spacing: -0.02em;
  }
  header p {
    margin: 0.2rem 0 0;
    color: var(--muted);
  }
  .corner {
    position: fixed;
    top: 1.25rem;
    right: 1.5rem;
    display: flex;
    gap: 0.75rem;
  }
  .book {
    font-weight: 700;
  }
  .count {
    font-weight: 400;
    margin-left: 0.35rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: var(--gold);
    border: 1.5px solid var(--ink);
  }
  @media (max-width: 40rem) {
    header p {
      display: none;
    }
    header {
      left: 1rem;
    }
    h1 {
      font-size: 1.5rem;
    }
    .corner {
      top: 3.6rem;
      left: 1rem;
      right: auto;
    }
  }
</style>
