<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { trapFocus } from '../trap-focus.ts';

  let {
    screen,
    onClose,
  }: {
    /** The screen the sheet opened on, which decides the rows. */
    screen: 'game' | 'sandbox';
    onClose: () => void;
  } = $props();

  type Row = { keys: string; does: string };
  /** Spec 12.5's rows, in its words, then the keys that Part 2 and peek add. */
  const GAME: readonly Row[] = [
    { keys: '1, 2, 3', does: 'Pick a tool' },
    { keys: 'Arrow keys', does: 'Move the lens or cursor' },
    { keys: 'Tab', does: 'Move to the next creature' },
    { keys: 'Enter', does: 'Act on the picked creature' },
    { keys: 'Space', does: 'Pause' },
    { keys: 'Z, X', does: 'Zoom out, zoom in' },
    { keys: 'J, B', does: 'Journal, Book of Skies' },
    { keys: 'Escape', does: 'Move to the tools' },
    { keys: '?', does: 'Help' },
    { keys: 'W', does: 'With Walk: wave at the picked creature' },
    { keys: 'G, H, R', does: 'With Respond: glow back, hold still, or rumble' },
    { keys: 'O, K', does: 'With Manner: give a gift, or keep it' },
    { keys: 'L', does: 'With Manner: plant a seed. Your hero must carry enough berries' },
    { keys: 'P', does: 'Look under the hood of the picked creature' },
  ];
  /** The sandbox has eight tools, and paths. */
  const SANDBOX: readonly Row[] = [
    { keys: '1 to 8', does: 'Pick a tool' },
    { keys: 'Arrow keys', does: 'Move the lens or cursor' },
    { keys: 'Tab', does: 'Move to the next creature' },
    { keys: 'Enter', does: 'Use the tool' },
    { keys: 'Enter, then Enter', does: 'With Paths: set the start of a path, then its end' },
    { keys: 'Space', does: 'Pause' },
    { keys: 'Escape', does: 'Move to the panels' },
    { keys: '?', does: 'Help' },
  ];
  const rows = $derived(screen === 'sandbox' ? SANDBOX : GAME);

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
    <h2 id="help-title" tabindex="-1">Keys</h2>
    <table>
      <thead>
        <tr><th scope="col">Key</th><th scope="col">What it does</th></tr>
      </thead>
      <tbody>
        {#each rows as row (row.keys)}
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
