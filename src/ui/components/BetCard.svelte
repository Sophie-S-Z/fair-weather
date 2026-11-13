<script lang="ts">
  import { onMount, tick } from 'svelte';

  let {
    question,
    options,
    label,
    onAnswer,
    home,
    heading = 'A bet',
  }: {
    question: string;
    options: readonly string[];
    label: (option: string) => string;
    onAnswer: (option: string) => void;
    /** Moves focus home on close when nothing held it at open, or that control has gone. */
    home: () => void;
    /** The card's heading and name: a bet, unless the card asks something else (a postcard home). */
    heading?: string;
  } = $props();

  let card: HTMLElement;

  // Focus moves in on open and back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    card.querySelector('button')?.focus();
    // After the update that closes the card, so the screen behind it is no longer inert.
    return () => {
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
        else home();
      });
    };
  });

  /** Escape does nothing until an answer; Tab stays inside the card. */
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
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
    aria-labelledby="bet-title"
    aria-describedby="bet-question"
    tabindex="-1"
    bind:this={card}
    onkeydown={onKey}
  >
    <h2 id="bet-title">{heading}</h2>
    <p id="bet-question">{question}</p>
    <div class="options">
      {#each options as option (option)}
        <button
          type="button"
          onclick={() => {
            onAnswer(option);
          }}>{label(option)}</button
        >
      {/each}
    </div>
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
