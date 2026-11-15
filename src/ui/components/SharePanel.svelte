<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { readValleyFile, saveFile } from '../save-file.ts';

  let {
    shared,
    fileName,
    onOpen,
    onClose,
  }: {
    /** What Share gave (ADR 0014 item 7): a link, the text of a valley file, or a run too long for either. */
    shared: { kind: 'link'; url: string } | { kind: 'file'; text: string } | { kind: 'tooOld' };
    /** The name a valley file saves under. */
    fileName: string;
    /** Opens the `v1.<data>` text of a valley file the player picked. */
    onOpen: (text: string) => void;
    onClose: () => void;
  } = $props();

  let card: HTMLElement;
  /** The line under Copy the link, in a status region. */
  let copied = $state('');

  // Focus moves in on open, and back to where it was (the Share button) on close.
  onMount(() => {
    const back = document.activeElement;
    card.querySelector<HTMLElement>('input, button')?.focus();
    // After the update that closes the panel, so the screen behind it is no longer inert.
    return () => {
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      copied = 'The link is copied.';
    } catch {
      copied = 'The link is not copied. Select the link and copy it.';
    }
  }

  async function pick(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
    const file = e.currentTarget.files?.[0];
    if (file) onOpen(await readValleyFile(file));
  }

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
    aria-labelledby="share-title"
    tabindex="-1"
    bind:this={card}
    onkeydown={onKey}
  >
    <h2 id="share-title">Share this valley</h2>
    {#if shared.kind === 'link'}
      {@const url = shared.url}
      <label for="share-link">Link to this valley</label>
      <input
        id="share-link"
        type="text"
        readonly
        value={url}
        onfocus={(e) => {
          e.currentTarget.select();
        }}
      />
      <button
        type="button"
        onclick={() => {
          void copy(url);
        }}>Copy the link</button
      >
      <p role="status">{copied}</p>
    {:else if shared.kind === 'file'}
      {@const text = shared.text}
      <p>This valley is too large for a link. Save it as a file.</p>
      <button
        type="button"
        onclick={() => {
          saveFile(new Blob([`${text}\n`], { type: 'application/octet-stream' }), fileName);
        }}>Save the file</button
      >
    {:else}
      <p>A link can hold at most 100 days. Start the valley again to share it.</p>
    {/if}
    <div class="open">
      <label for="share-open">Open a valley file</label>
      <input id="share-open" type="file" accept=".fairweather" onchange={pick} />
    </div>
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 0;
  }
  #share-link {
    width: 100%;
    box-sizing: border-box;
    min-height: 2.75rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 2px solid var(--muted);
    border-radius: 0.4rem;
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }
  /* Below 600 pixels the panel is a full-screen sheet (ADR 0014 item 15). */
  @media (max-width: 600px) {
    .card {
      width: 100vw;
      max-height: none;
      height: 100vh;
      border-radius: 0;
    }
  }
</style>
