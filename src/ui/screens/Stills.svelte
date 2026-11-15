<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sceneStill } from '../../story/stills.ts';
  import Note from '../components/Note.svelte';
  import type { GameService } from '../game-service.ts';
  import { retryImage } from '../retry-image.ts';

  let {
    game,
    at,
    onExit,
  }: { game: GameService; /** The chapter whose page opens first. */ at: number; onExit: () => void } =
    $props();

  // The pages are read once: the still version has no live state.
  // svelte-ignore state_referenced_locally
  const pages = game.stills();
  // svelte-ignore state_referenced_locally
  let index = $state(Math.min(Math.max(at, 0), Math.max(pages.length - 1, 0)));
  const page = $derived(pages[index] ?? null);
  /** After the last chapter's page comes the end page. */
  const ended = $derived(page === null);
  let heading: HTMLElement | undefined = $state();

  /** The scene's image for a page whose own image fails, or null when its own is the scene's. */
  function fallbackOf(id: string): string | null {
    const chapter = game.chapters.find((c) => c.id === id);
    return chapter?.still ? game.stillUrl(sceneStill(chapter.scene)) : null;
  }

  /** Moves to a page and puts the focus on its heading, so a screen reader reads the new page. */
  async function go(to: number): Promise<void> {
    index = to;
    await tick();
    heading?.focus();
  }

  onMount(() => {
    heading?.focus();
  });
</script>

<main>
  <p class="why">
    This browser cannot show the moving valley. You see a still picture of each chapter with all of its text.
  </p>
  {#if page}
    <article aria-labelledby="still-title">
      <h1 id="still-title" tabindex="-1" bind:this={heading}>{page.title}</h1>
      <p class="count">Page {index + 1} of {pages.length}</p>
      {#key page.id}
        <img
          src={game.stillUrl(page.still)}
          alt={page.title}
          width="320"
          height="200"
          use:retryImage={{ waits: game.assetWaits, fallback: fallbackOf(page.id) }}
        />
      {/key}
      {#each page.lines as line, i (i)}
        <p>{line}</p>
      {/each}
      {#if page.notes.length > 0}
        <h2>Margin notes</h2>
        {#each page.notes as note, i (i)}
          <Note {note} level={3} />
        {/each}
      {/if}
    </article>
  {:else}
    <h1 id="still-title" tabindex="-1" bind:this={heading}>The End</h1>
  {/if}
  <nav aria-label="Pages">
    <button type="button" disabled={index === 0} onclick={() => void go(index - 1)}>Back</button>
    {#if !ended}
      <button type="button" onclick={() => void go(index + 1)}>Next</button>
    {/if}
    <button type="button" onclick={onExit}>Back to title</button>
  </nav>
</main>

<style>
  main {
    max-width: 36rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .why,
  .count {
    color: var(--muted);
  }
  h1:focus-visible {
    outline-offset: 4px;
  }
  img {
    max-width: 100%;
    height: auto;
    background: #fff;
    border: 1px solid var(--muted);
  }
  h2 {
    font-size: 1.1rem;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
</style>
