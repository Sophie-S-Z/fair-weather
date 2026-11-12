<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { displayName } from '../../story/names.ts';
  import { poppable } from './activities.ts';

  let { lite, finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  /** A bubble floats over each sleeper with a scar (a tie with a warmth below 0), in cast order. */
  const bubbles = untrack(() =>
    lite.creatures
      .filter(
        (c) =>
          c.state === 'sleep' &&
          lite.ties.some((t) => (t.a === c.id || t.b === c.id) && (t.ab < 0 || t.ba < 0)),
      )
      .map((c) => c.id),
  );
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
    if (floating.every((b) => !poppable(b))) {
      end();
      return;
    }
    // The popped button is gone, so focus moves to the bubble now in its place.
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
  /* A real year's carry can float a bubble over almost every sleeper, so the list scrolls. */
  .bubbles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    max-height: 40vh;
    overflow-y: auto;
    padding: 0.25rem;
  }
  .bubble {
    width: 4rem;
    height: 4rem;
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
