<script lang="ts">
  import { untrack } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { displayName } from '../../story/names.ts';
  import { copySketch } from './activities.ts';

  let { lite, finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  const COPIES = 6;
  /** [PLACEHOLDER] art: a harmless beetle, drawn by hand as one line in a 120 by 100 box. */
  const BEETLE = [
    52, 30, 50, 24, 53, 19, 46, 8, 53, 19, 60, 17, 67, 19, 74, 8, 67, 19, 70, 24, 68, 30, 76, 36, 80, 46, 94,
    40, 80, 46, 81, 58, 96, 58, 81, 58, 78, 70, 92, 80, 78, 70, 72, 80, 60, 85, 48, 80, 42, 70, 28, 80, 42,
    70, 39, 58, 24, 58, 39, 58, 40, 46, 26, 40, 40, 46, 44, 36, 52, 30, 60, 32, 60, 84,
  ];
  /** The hands the sketch passes through: the creatures here at the start, in cast order. */
  const hands = untrack(() => lite.creatures.filter((c) => c.state !== 'away' && !c.gone).map((c) => c.id));
  const hand = (copy: number): string => displayName(hands[copy % hands.length] ?? 'someone');

  let copy = $state(0);
  const points = $derived(copySketch(BEETLE, copy).join(' '));

  function pass(): void {
    if (copy >= COPIES) return;
    copy += 1;
    if (copy === COPIES) finish('done');
  }
</script>

<section aria-label="The sketch">
  <p>[PLACEHOLDER] {hand(0)} draws a beetle. Pass the sketch on, and each paw copies it.</p>
  <svg
    viewBox="0 0 120 100"
    role="img"
    aria-label={copy === 0
      ? `${hand(0)}'s first sketch`
      : `${hand(copy)} holds copy ${String(copy)} of ${String(COPIES)}`}
  >
    <polyline {points} />
  </svg>
  <p role="status">
    {copy === 0 ? '' : `[PLACEHOLDER] ${hand(copy)} copies it. Copy ${String(copy)} of ${String(COPIES)}.`}
  </p>
  <button type="button" onclick={pass}>Pass it on</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  svg {
    width: 9rem;
    height: 7.5rem;
  }
  polyline {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linejoin: round;
  }
</style>
