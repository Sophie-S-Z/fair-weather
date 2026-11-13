<script lang="ts">
  import { onMount, tick } from 'svelte';

  let {
    target,
    others,
    label,
    onWhisper,
    onCancel,
  }: {
    /** The creature who hears the whisper. */
    target: string;
    /** The creatures it can be about. */
    others: readonly string[];
    label: (id: string) => string;
    onWhisper: (about: string, sign: 1 | -1) => void;
    onCancel: () => void;
  } = $props();

  let card: HTMLElement;
  /** The creature picked in the first step; then the card asks kind or unkind. */
  let about: string | null = $state(null);

  // Focus moves in on open, to the first button of each step, and back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    card.querySelector('button')?.focus();
    // After the update that closes the card, so the screen behind it is no longer inert.
    return () => {
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  async function choose(id: string): Promise<void> {
    about = id;
    await tick();
    card.querySelector('button')?.focus();
  }

  /** Escape cancels; Tab stays inside the card. */
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      const buttons = [...card.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
</script>

<div class="backdrop">
  <div
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="whisper-title"
    aria-describedby="whisper-step"
    tabindex="-1"
    bind:this={card}
    onkeydown={onKey}
  >
    <h2 id="whisper-title">Whisper about whom?</h2>
    {#if about === null}
      <p id="whisper-step">To {label(target)}. Escape cancels.</p>
      <div class="options">
        {#each others as id (id)}
          <button
            type="button"
            onclick={() => {
              void choose(id);
            }}>{label(id)}</button
          >
        {/each}
      </div>
    {:else}
      {@const who = about}
      <p id="whisper-step">To {label(target)}, about {label(who)}.</p>
      <div class="options">
        <button
          type="button"
          onclick={() => {
            onWhisper(who, 1);
          }}>Kind</button
        >
        <button
          type="button"
          onclick={() => {
            onWhisper(who, -1);
          }}>Unkind</button
        >
      </div>
    {/if}
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
    max-width: 28rem;
    margin: 1rem;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  h2 {
    margin-top: 0;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
