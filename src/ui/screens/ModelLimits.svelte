<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { MODEL_LIMITS } from '../../story/limits.ts';

  let {
    modal = false,
    onBack,
  }: {
    /** In the game and the sandbox: a modal dialog that keeps focus, and Escape closes it. On the title: a page. */
    modal?: boolean;
    onBack: () => void;
  } = $props();

  let root: HTMLElement | undefined = $state();
  /** Heading levels: under the screen's own heading in the dialog, the page's top heading on the title. */
  const h = (n: number): string => `h${String(n + (modal ? 1 : 0))}`;

  // Focus moves to the heading on open; the dialog gives it back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    root?.querySelector<HTMLElement>('#limits-title')?.focus();
    if (!modal) return;
    return () => {
      // After the update that closes the dialog, so the screen behind it is no longer inert.
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  /** Escape closes the dialog; Tab stays inside it, across its links and its Back button. */
  function onKey(e: KeyboardEvent): void {
    if (!modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    } else if (e.key === 'Tab') {
      const stops = [...(root?.querySelectorAll<HTMLElement>('a[href], button') ?? [])];
      const first = stops[0];
      const last = stops[stops.length - 1];
      const inside = stops.some((s) => s === document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
</script>

{#snippet limits()}
  <svelte:element this={h(1)} id="limits-title" tabindex="-1">{MODEL_LIMITS.title}</svelte:element>
  {#each MODEL_LIMITS.items as item, i (i)}
    <section aria-labelledby="limit-{i}">
      <svelte:element this={h(2)} id="limit-{i}">{item.heading}</svelte:element>
      <p>{item.text}</p>
      {#if item.sources.length > 0}
        <ul aria-label="Sources">
          {#each item.sources as source, j (j)}
            <li><a href={source.url}>{source.label}</a></li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
  <button type="button" onclick={onBack}>Back</button>
{/snippet}

{#if modal}
  <div class="backdrop">
    <div
      class="card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="limits-title"
      tabindex="-1"
      bind:this={root}
      onkeydown={onKey}
    >
      {@render limits()}
    </div>
  </div>
{:else}
  <section class="page" aria-labelledby="limits-title" bind:this={root}>
    {@render limits()}
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
  section {
    margin: 1.25rem 0;
    padding-top: 0.5rem;
    border-top: 2px solid var(--muted);
  }
  section > :global(h2),
  section > :global(h3) {
    font-size: 1rem;
    margin: 0.5rem 0 0.25rem;
  }
  section :global(p) {
    margin: 0.25rem 0;
  }
  ul {
    padding-left: 1.25rem;
  }
  a {
    color: var(--accent);
  }
</style>
