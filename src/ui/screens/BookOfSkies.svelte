<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { BookPage } from '../../persist/profile.ts';
  import { displayName } from '../../story/names.ts';

  let {
    pages,
    feathers,
    modal = false,
    onBack,
  }: {
    pages: readonly BookPage[];
    feathers: number;
    /** In the game: a modal dialog that keeps focus, and Escape closes it. On the title: a page. */
    modal?: boolean;
    onBack: () => void;
  } = $props();

  let root: HTMLElement | undefined = $state();
  /** Heading levels: under the game's own heading in the dialog, the page's top heading on the title. */
  const h = (n: number): string => `h${String(n + (modal ? 1 : 0))}`;

  // Focus moves to the heading on open; the dialog gives it back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    root?.querySelector<HTMLElement>('#book-title')?.focus();
    if (!modal) return;
    return () => {
      // After the update that closes the dialog, so the screen behind it is no longer inert.
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  /** Escape closes the dialog; Tab stays inside it. */
  function onKey(e: KeyboardEvent): void {
    if (!modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    } else if (e.key === 'Tab') {
      const buttons = [...(root?.querySelectorAll('button') ?? [])];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inButtons = buttons.some((b) => b === document.activeElement);
      if (e.shiftKey && (!inButtons || document.activeElement === first)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
</script>

{#snippet book()}
  <svelte:element this={h(1)} id="book-title" tabindex="-1">Book of Skies</svelte:element>
  {#if feathers > 0}
    <p>Feathers from the Quiet Visitor: {feathers}</p>
  {/if}
  {#if pages.length === 0}
    <p>[PLACEHOLDER] No year is written here yet. When a year ends, its sky story is kept here.</p>
  {/if}
  {#each pages as page (page.year)}
    <article aria-labelledby="year-{page.year}">
      <svelte:element this={h(2)} id="year-{page.year}">Year {page.year}</svelte:element>
      <p class="narrator">Told by {displayName(page.narrator)}</p>
      {#each page.verses as verse (verse.title)}
        <svelte:element this={h(3)}>{verse.title}</svelte:element>
        <p>{verse.text}</p>
        {#if verse.note}
          <aside>What the sky did: {verse.note}</aside>
        {/if}
      {/each}
    </article>
  {/each}
  <button type="button" onclick={onBack}>Back</button>
{/snippet}

{#if modal}
  <div class="backdrop">
    <div
      class="card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-title"
      tabindex="-1"
      bind:this={root}
      onkeydown={onKey}
    >
      {@render book()}
    </div>
  </div>
{:else}
  <section class="page" aria-labelledby="book-title" bind:this={root}>
    {@render book()}
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.25);
  }
  .card {
    box-sizing: border-box;
    width: min(36rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  .card > :global(:first-child) {
    margin-top: 0;
  }
  article {
    margin: 1.5rem 0;
    padding-top: 0.5rem;
    border-top: 2px solid var(--muted);
  }
  article > :global(h2),
  article > :global(h3),
  article > :global(h4) {
    font-size: 1rem;
    margin: 0.75rem 0 0.25rem;
  }
  article :global(p) {
    margin: 0.25rem 0;
  }
  .narrator,
  aside {
    font-style: italic;
    color: var(--muted);
  }
  aside {
    margin: 0.25rem 0 0.5rem;
  }
</style>
