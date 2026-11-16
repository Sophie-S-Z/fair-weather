<script lang="ts">
  import { untrack } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { displayName } from '../../story/names.ts';
  import { copySketch } from './activities.ts';

  let { lite, finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  const COPIES = 6;
  /**
   * A harmless beetle in a 120 by 100 box, drawn by hand as one line: the head, two feelers out and
   * back, the round shell with six legs out and back, and the split down its wing case.
   */
  const BEETLE = [
    60, 33, 58, 33, 56, 32, 54, 31, 53, 30, 52, 28, 52, 26, 52, 24, 53, 22, 54, 21, 56, 20, 52, 14, 47, 9, 44,
    9, 47, 9, 52, 14, 56, 20, 58, 19, 60, 19, 62, 19, 64, 20, 68, 14, 73, 9, 76, 9, 73, 9, 68, 14, 64, 20, 66,
    21, 67, 22, 68, 24, 68, 26, 68, 28, 67, 30, 66, 31, 64, 32, 62, 33, 60, 33, 60, 33, 62, 33, 65, 34, 67,
    35, 70, 36, 72, 38, 73, 40, 75, 42, 76, 45, 86, 42, 92, 38, 86, 42, 76, 45, 78, 48, 78, 51, 79, 54, 79,
    57, 88, 57, 96, 58, 88, 57, 79, 57, 79, 60, 78, 63, 78, 66, 76, 69, 86, 72, 92, 80, 86, 72, 76, 69, 75,
    72, 73, 74, 72, 76, 70, 78, 67, 79, 65, 80, 62, 81, 60, 81, 58, 81, 55, 80, 53, 79, 51, 78, 48, 76, 47,
    74, 45, 72, 44, 69, 34, 72, 28, 80, 34, 72, 44, 69, 42, 66, 42, 63, 41, 60, 41, 57, 32, 57, 24, 58, 32,
    57, 41, 57, 41, 54, 42, 51, 42, 48, 44, 45, 34, 42, 28, 38, 34, 42, 44, 45, 45, 42, 47, 40, 48, 38, 50,
    36, 53, 35, 55, 34, 58, 33, 60, 33, 60, 70, 60, 81,
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
  <p>{hand(0)} draws a beetle from memory. Pass the sketch along, and each paw copies the copy before it.</p>
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
    {copy === 0 ? '' : `${hand(copy)} copies it. Copy ${String(copy)} of ${String(COPIES)}.`}
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
