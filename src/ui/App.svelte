<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { BookPage } from '../persist/profile.ts';
  import type { GameService } from './game-service.ts';
  import type { Settings } from './settings.ts';
  import Title from './screens/Title.svelte';
  import SettingsScreen from './screens/Settings.svelte';
  import Game from './screens/Game.svelte';
  import BookOfSkies from './screens/BookOfSkies.svelte';
  import Sandbox from './screens/Sandbox.svelte';
  import type { SandboxValley } from '../story/sandbox.ts';

  let { settings, hasSave, game }: { settings: Writable<Settings>; hasSave: boolean; game: GameService } =
    $props();

  /** A dev build's ?sandbox=new opens the sandbox on a new Kith valley, once. */
  let sandboxNew = $state(untrack(() => game.sandbox.devOpen));
  let screen: 'title' | 'settings' | 'game' | 'book' | 'sandbox' = $state(
    untrack(() => game.sandbox.devOpen) ? 'sandbox' : 'title',
  );
  let saved = $state(false);
  let resume = $state(false);
  let book: { pages: BookPage[]; feathers: number } = $state.raw({ pages: [], feathers: 0 });
  let sandbox: { unlocked: boolean; kith: boolean; valleys: SandboxValley[] } = $state.raw({
    unlocked: false,
    kith: false,
    valleys: [],
  });
  /** Why the title's Sandbox button is disabled (ADR 0014 item 1), or null while it opens. */
  const sandboxClosed = $derived(
    !game.webgl
      ? 'The sandbox needs WebGL. This browser does not have it.'
      : sandbox.unlocked
        ? null
        : 'The sandbox opens when you finish Part 1.',
  );

  /** Reads the saves and the Book of Skies, for Continue and the Book of Skies buttons. */
  function readStore(): void {
    void game.hasSave().then((s) => {
      saved = s;
    });
    void Promise.all([game.book(), game.feathers()]).then(([pages, feathers]) => {
      book = { pages, feathers };
    });
    void game.sandbox.status().then((s) => {
      sandbox = s;
    });
  }

  // The title shows Continue and the Book of Skies once the saves have been read.
  onMount(() => {
    if (hasSave) saved = true;
    readStore();
  });

  function play(fromSave: boolean): void {
    resume = fromSave;
    screen = 'game';
  }
  function leaveGame(): void {
    screen = 'title';
    readStore();
  }
  /** Back to the title, with focus on the Sandbox button that opened the sandbox. */
  function leaveSandbox(): void {
    sandboxNew = false;
    screen = 'title';
    readStore();
    void tick().then(() => document.getElementById('title-sandbox')?.focus());
  }

  $effect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${String(100 * $settings.textScale)}%`;
    root.dataset['contrast'] = $settings.highContrast ? 'high' : 'normal';
    root.dataset['motion'] = $settings.reducedMotion ? 'reduced' : 'full';
  });
</script>

{#if screen === 'game'}
  <Game {game} {settings} {resume} onExit={leaveGame} />
{:else if screen === 'sandbox'}
  <Sandbox {game} {settings} status={sandbox} openNew={sandboxNew} onExit={leaveSandbox} />
{:else}
  <main>
    {#if screen === 'title'}
      <Title
        hasSave={saved}
        hasBook={book.pages.length > 0}
        onBook={() => (screen = 'book')}
        onBegin={() => {
          play(false);
        }}
        onContinue={() => {
          play(true);
        }}
        {sandboxClosed}
        onSandbox={() => (screen = 'sandbox')}
        onSettings={() => (screen = 'settings')}
      />
    {:else if screen === 'book'}
      <BookOfSkies pages={book.pages} feathers={book.feathers} onBack={() => (screen = 'title')} />
    {:else}
      <SettingsScreen {settings} onBack={() => (screen = 'title')} />
    {/if}
  </main>
{/if}

<style>
  :global(:root) {
    --bg: #f6f1e7;
    --fg: #1f2a33;
    --accent: #0b5a7a;
    --muted: #4d5a63;
  }
  :global(:root[data-contrast='high']) {
    --bg: #000;
    --fg: #fff;
    --accent: #ffe066;
    --muted: #e0e0e0;
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, sans-serif;
  }
  :global(button) {
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 2px solid var(--accent);
    border-radius: 0.4rem;
    padding: 0.5rem 1rem;
    min-height: 2.75rem;
    cursor: pointer;
  }
  :global(button:disabled) {
    color: var(--muted);
    border-style: dashed;
    cursor: not-allowed;
  }
  :global(:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  /* Text for a screen reader only. */
  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* A row of choices with a legend, as the sandbox panels have. */
  :global(fieldset.choices) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin: 0;
    padding: 0.25rem 0.5rem 0.5rem;
    border: 1px solid var(--muted);
    border-radius: 0.4rem;
  }
  /* One choice: its box or dot, then its words. */
  :global(.choice-row) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 1.75rem;
  }
  /* Each box and dot in a row of choices, or in one choice, is a 24-pixel target (WCAG 2.5.8). */
  :global(.choices input[type='radio']),
  :global(.choices input[type='checkbox']),
  :global(.choice-row input[type='checkbox']) {
    width: 1.5rem;
    height: 1.5rem;
    margin: 0;
    accent-color: var(--accent);
  }
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
</style>
