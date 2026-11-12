<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorldLite } from '../../sim-host/protocol.ts';

  // Every activity takes the same props (Game.svelte); this one does not read the world.
  // eslint-disable-next-line svelte/no-unused-props
  let {
    finish,
    createHoldStill,
  }: {
    lite: WorldLite;
    finish: (result: string) => void;
    createHoldStill: () => { move(x: number, y: number): void; held(): number };
  } = $props();

  /** The seconds of stillness that calm the village. */
  const CALM = 5;
  /** How often the meter reads the timer, in milliseconds. */
  const READ_MS = 250;

  let held = $state(0);

  // Nothing to press: the night ends once the pointer rests, and keyboard play only waits.
  onMount(() => {
    const hold = createHoldStill();
    const onMove = (e: PointerEvent): void => {
      hold.move(e.clientX, e.clientY);
    };
    window.addEventListener('pointermove', onMove);
    const timer = setInterval(() => {
      held = Math.min(CALM, hold.held());
      if (held < CALM) return;
      clearInterval(timer);
      finish('done');
    }, READ_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointermove', onMove);
    };
  });
</script>

<section aria-label="Hold still">
  <p>[PLACEHOLDER] The village shivers in the dark. Rest the pointer over them and hold it still.</p>
  <progress aria-label="Stillness" max={CALM} value={held}></progress>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  progress {
    width: 12rem;
    accent-color: var(--accent);
  }
</style>
