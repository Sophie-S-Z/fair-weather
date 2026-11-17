<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { trapFocus } from '../trap-focus.ts';

  let {
    rows,
    intro = false,
    onClose,
  }: {
    /** The keys that work on the screen the sheet opened on (keyRows in input/keyboard.ts). */
    rows: readonly { keys: string; does: string }[];
    /** The story's sheet: a short How to play before the keys. */
    intro?: boolean;
    onClose: () => void;
  } = $props();

  let root: HTMLElement | undefined = $state();

  // Focus moves to the heading on open, and back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    root?.querySelector<HTMLElement>('#help-title')?.focus();
    return () => {
      // After the update that closes the sheet, so the screen behind it is no longer inert.
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
      });
    };
  });

  /** Escape closes the sheet. */
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }
</script>

<div class="backdrop">
  <div
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
    tabindex="-1"
    bind:this={root}
    onkeydown={onKey}
    use:trapFocus
  >
    {#if intro}
      <h2 id="help-title" tabindex="-1">How to play</h2>
      <p>You are the weather over a small valley. You do not speak. You act, and the creatures answer.</p>
      <ol>
        <li>Choose a tool at the bottom of the screen.</li>
        <li>Click a creature or a spot in the meadow to use the tool. On a touch screen, tap.</li>
        <li>Read the story lines over the tools. They tell you what happens.</li>
      </ol>
      <p>
        The <strong>Try this</strong> box over the tools tells you what to do next. Diary and notes tells you the
        ideas behind each chapter. Pause stops time, and 2× makes it go faster.
      </p>
      <h3>Keys</h3>
    {:else}
      <h2 id="help-title" tabindex="-1">Keys</h2>
    {/if}
    <table>
      <thead>
        <tr><th scope="col">Key</th><th scope="col">What it does</th></tr>
      </thead>
      <tbody>
        {#each rows as row (`${row.keys} ${row.does}`)}
          <tr><th scope="row"><kbd>{row.keys}</kbd></th><td>{row.does}</td></tr>
        {/each}
      </tbody>
    </table>
    <button type="button" onclick={onClose}>Close</button>
  </div>
</div>

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
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  h2 {
    margin: 0 0 0.75rem;
  }
  h3 {
    margin: 1rem 0 0.25rem;
  }
  ol {
    padding-left: 1.25rem;
  }
  table {
    width: 100%;
    margin-bottom: 1rem;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 0.35rem 0.75rem 0.35rem 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--muted);
  }
  tbody th {
    white-space: nowrap;
    font-weight: 400;
  }
  kbd {
    font: inherit;
    font-weight: 700;
    border: 1px solid currentColor;
    border-radius: 0.2rem;
    padding: 0 0.3em;
  }
  /* Below 600 pixels the sheet takes the whole viewport (ADR 0014 item 15). */
  @media (max-width: 599.98px) {
    .card {
      width: 100vw;
      max-height: none;
      height: 100vh;
      height: 100dvh;
      border-width: 0;
      border-radius: 0;
    }
  }
</style>
