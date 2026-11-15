<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { characters } from '../../story/journey.ts';
  import { saveFile } from '../save-file.ts';

  let {
    onMake,
    onClose,
  }: {
    /** The postcard GIF of the last 5 seconds with the caption (SandboxService.postcard). */
    onMake: (caption: string) => Promise<Blob>;
    onClose: () => void;
  } = $props();

  /** The longest caption, in characters (graphemes): an emoji counts as one (ADR 0014 item 8). */
  const CAPTION_LENGTH = 60;

  let card: HTMLElement;
  let caption = $state('');
  let saving = $state(false);
  /** The line under Save the postcard, in a status region. */
  let said = $state('');

  // Focus moves in on open, and back to where it was (the Make a postcard button) on close.
  onMount(() => {
    const back = document.activeElement;
    card.querySelector<HTMLElement>('input')?.focus();
    // After the update that closes the dialog, so the screen behind it is no longer inert.
    return () => {
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  /** Cuts the caption to CAPTION_LENGTH, but never in the middle of an input method's composition. */
  function limit(e: Event): void {
    if (e instanceof InputEvent && e.isComposing) return;
    const chars = characters(caption);
    if (chars.length > CAPTION_LENGTH) caption = chars.slice(0, CAPTION_LENGTH).join('');
  }

  async function save(): Promise<void> {
    saving = true;
    said = '';
    try {
      saveFile(await onMake(caption), 'fair-weather-postcard.gif');
    } catch (e) {
      console.error(e);
      said = 'The game could not make the postcard.';
    }
    saving = false;
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Not while it saves, as Close is off then.
      if (!saving) onClose();
    }
  }
</script>

<div class="backdrop">
  <div
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="postcard-title"
    tabindex="-1"
    bind:this={card}
    onkeydown={onKey}
  >
    <h2 id="postcard-title">Make a postcard</h2>
    <label for="postcard-caption">Caption (at most {CAPTION_LENGTH} characters)</label>
    <input id="postcard-caption" type="text" bind:value={caption} oninput={limit} oncompositionend={limit} />
    <p id="postcard-line">
      The image shows the words that you wrote. It stays on this device until you share it.
    </p>
    <button type="button" disabled={saving} aria-describedby="postcard-line" onclick={() => void save()}
      >Save the postcard</button
    >
    <p role="status">{said}</p>
    <button type="button" disabled={saving} onclick={onClose}>Close</button>
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
  h2,
  p {
    margin: 0;
  }
  #postcard-caption {
    width: 100%;
    box-sizing: border-box;
    min-height: 2.75rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 2px solid var(--muted);
    border-radius: 0.4rem;
  }
  /* Below 600 pixels the dialog is a full-screen sheet (ADR 0014 item 15). */
  @media (max-width: 600px) {
    .card {
      width: 100vw;
      max-height: none;
      height: 100vh;
      border-radius: 0;
    }
  }
</style>
