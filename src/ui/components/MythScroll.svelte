<script lang="ts">
  import type { MythPage } from '../../myth/grammar.ts';
  import { displayName } from '../../story/names.ts';

  let { page, finish }: { page: MythPage; finish: () => void } = $props();

  /** How many verses the player has heard. */
  let heard = $state(0);
  let noteOpen = $state(false);
  const verse = $derived(heard > 0 ? page.verses[heard - 1] : undefined);

  function listen(): void {
    if (heard >= page.verses.length) return;
    heard += 1;
    noteOpen = false;
    if (heard === page.verses.length) finish();
  }
</script>

<section aria-labelledby="myth-heading">
  <h2 id="myth-heading">The Sky Story, told by {displayName(page.narrator)}</h2>
  <!-- One verse at a time; each new one is announced. -->
  <div aria-live="polite">
    {#if verse}
      <h3>{verse.title}</h3>
      <p>{verse.text}</p>
    {/if}
  </div>
  {#if verse?.note}
    <button
      type="button"
      aria-expanded={noteOpen}
      aria-controls="myth-note"
      onclick={() => (noteOpen = !noteOpen)}>What the sky did</button
    >
    <p id="myth-note" class="note" hidden={!noteOpen}>{verse.note}</p>
  {/if}
  <button type="button" onclick={listen}>Listen</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    max-width: 36rem;
    text-align: center;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2,
  h3 {
    font-size: 1rem;
  }
  .note {
    font-style: italic;
    color: var(--muted);
  }
</style>
