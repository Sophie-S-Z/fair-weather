<script lang="ts">
  import { untrack } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { displayName } from '../../story/names.ts';
  import { RHYTHMS, sharedRhythm } from './activities.ts';

  let { lite, finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  /** The two at the door: the first two creatures here, in cast order. */
  const [left = 'someone', right = 'someone'] = untrack(() =>
    lite.creatures.filter((c) => c.state !== 'away' && !c.gone).map((c) => displayName(c.id)),
  );
  /** The rhythms each side of the frosted door taps back; they share one. */
  const LEFT = [0, 2];
  const RIGHT = [2, 3];
  const shared = sharedRhythm(LEFT, RIGHT);

  let answer = $state('');
  let open = false;

  function tap(i: number): void {
    if (open) return;
    if (i === shared) {
      open = true;
      answer = `[PLACEHOLDER] ${left} and ${right} both tap it back, and the door opens.`;
      finish(String(i));
    } else if (LEFT.includes(i)) {
      answer = `[PLACEHOLDER] ${left} taps it back. ${right} stays quiet.`;
    } else if (RIGHT.includes(i)) {
      answer = `[PLACEHOLDER] ${right} taps it back. ${left} stays quiet.`;
    } else {
      answer = '[PLACEHOLDER] Nobody taps it back.';
    }
  }
</script>

<section aria-label="Rhythms at the door">
  <p>
    [PLACEHOLDER] {left} and {right} sit on each side of a frosted door. Tap a rhythm, and find the one that both
    tap back.
  </p>
  <div class="rhythms">
    {#each RHYTHMS as rhythm, i (i)}
      <!-- The name says the pattern in words; the dots show it. -->
      <button
        type="button"
        aria-label="Tap rhythm {i + 1}: {rhythm.map((b) => (b === 1 ? 'tap' : 'rest')).join(', ')}"
        onclick={() => {
          tap(i);
        }}
      >
        Tap rhythm {i + 1}
        <span class="beats" aria-hidden="true">
          {#each rhythm as beat, b (b)}<span class:tap={beat === 1}></span>{/each}
        </span>
      </button>
    {/each}
  </div>
  <p role="status">{answer}</p>
</section>

<style>
  .rhythms {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  .beats {
    display: flex;
    gap: 0.3rem;
  }
  /* A rest is a small ring, a tap a large dot: shape tells them apart, not only color. */
  .beats span {
    width: 0.45rem;
    height: 0.45rem;
    border: 2px solid currentColor;
    border-radius: 50%;
  }
  .beats span.tap {
    width: 0.75rem;
    height: 0.75rem;
    background: currentColor;
  }
</style>
