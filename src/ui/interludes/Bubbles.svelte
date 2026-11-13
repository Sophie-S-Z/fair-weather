<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { displayName } from '../../story/names.ts';
  import { dreamers, poppable } from './activities.ts';

  let { lite, finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  /** The grudges that float, from the world at the start. */
  const bubbles = untrack(() => dreamers(lite));
  /** With nothing to pop, the player lets the village sleep. */
  const calm = !bubbles.some(poppable);

  let list: HTMLElement;
  let popped: string[] = $state([]);
  const floating = $derived(bubbles.filter((b) => !popped.includes(b)));
  let wobbling: string | null = $state(null);
  let said = $state('');
  let done = false;

  function pop(id: string): void {
    if (done) return;
    if (!poppable(id)) {
      wobbling = id;
      said = `[PLACEHOLDER] ${displayName(id)}'s bubble wobbles and stays.`;
      return;
    }
    const at = floating.indexOf(id);
    popped = [...popped, id];
    said = `[PLACEHOLDER] ${displayName(id)}'s grudge pops and drifts away.`;
    if (floating.every((b) => !poppable(b))) end();
    // The popped button is gone, so focus moves to the bubble now in its place, or to Moss's.
    void tick().then(() => {
      const left = list.querySelectorAll('button');
      left[Math.min(at, left.length - 1)]?.focus();
    });
  }
  function end(): void {
    done = true;
    finish('done');
  }
</script>

<section aria-label="Dream bubbles">
  <p>
    {bubbles.length === 0
      ? '[PLACEHOLDER] The village sleeps, and no grudge floats tonight.'
      : '[PLACEHOLDER] Grudges float over the sleepers. Pop them with a soft touch.'}
  </p>
  <div class="bubbles" bind:this={list}>
    {#each floating as id (id)}
      <button
        type="button"
        class="bubble"
        class:wobble={wobbling === id}
        aria-label="Pop {displayName(id)}'s bubble"
        onanimationend={() => (wobbling = null)}
        onclick={() => {
          pop(id);
        }}>{displayName(id)}</button
      >
    {/each}
  </div>
  <p role="status">{said}</p>
  {#if calm}
    <button type="button" onclick={end}>Let them sleep</button>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .bubbles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .bubble {
    width: 4.5rem;
    height: 4.5rem;
    padding: 0.25rem;
    font-size: 0.8em;
    border-radius: 50%;
  }
  .wobble {
    animation: wobble 0.6s ease-in-out 2;
  }
  :global(:root[data-motion='reduced']) .wobble {
    animation: none;
  }
  @keyframes wobble {
    25% {
      transform: scale(1.08, 0.94);
    }
    75% {
      transform: scale(0.94, 1.08);
    }
  }
</style>
