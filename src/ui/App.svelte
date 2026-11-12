<script lang="ts">
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { BookPage } from '../persist/profile.ts';
  import type { GameService } from './game-service.ts';
  import type { Settings } from './settings.ts';
  import Title from './screens/Title.svelte';
  import SettingsScreen from './screens/Settings.svelte';
  import Game from './screens/Game.svelte';
  import BookOfSkies from './screens/BookOfSkies.svelte';

  let { settings, hasSave, game }: { settings: Writable<Settings>; hasSave: boolean; game: GameService } =
    $props();

  let screen: 'title' | 'settings' | 'game' | 'book' = $state('title');
  let saved = $state(false);
  let resume = $state(false);
  let book: { pages: BookPage[]; feathers: number } = $state.raw({ pages: [], feathers: 0 });

  /** Reads the saves and the Book of Skies, for Continue and the Book of Skies buttons. */
  function readStore(): void {
    void game.hasSave().then((s) => {
      saved = s;
    });
    void Promise.all([game.book(), game.feathers()]).then(([pages, feathers]) => {
      book = { pages, feathers };
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

  $effect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${String(100 * $settings.textScale)}%`;
    root.dataset['contrast'] = $settings.highContrast ? 'high' : 'normal';
    root.dataset['motion'] = $settings.reducedMotion ? 'reduced' : 'full';
  });
</script>

{#if screen === 'game'}
  <Game {game} {settings} {resume} onExit={leaveGame} />
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
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
</style>
