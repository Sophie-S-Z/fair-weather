<script lang="ts">
  import { onMount } from 'svelte';

  let {
    finish,
    createHoldStill,
    paused,
  }: {
    finish: (result: string) => void;
    createHoldStill: () => { move(x: number, y: number): void; held(): number };
    /** The game is paused: the stillness waits too. */
    paused: boolean;
  } = $props();

  /** The seconds of stillness that calm the village. */
  const CALM = 5;
  /** How often the meter reads the timer, in milliseconds. */
  const READ_MS = 250;

  /** The seconds held still, counted only while the game runs and the tab shows. */
  let still = $state(0);

  // Nothing to press: the night ends after five seconds with no pointer move and no key press.
  onMount(() => {
    const hold = createHoldStill();
    let last = performance.now();
    const onMove = (e: PointerEvent): void => {
      hold.move(e.clientX, e.clientY);
    };
    const onKey = (): void => {
      still = 0;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    const timer = setInterval(() => {
      const now = performance.now();
      const step = (now - last) / 1000;
      last = now;
      if (paused || document.visibilityState === 'hidden') return;
      // A move inside this step restarts the count from the move.
      const held = hold.held();
      still = Math.min(CALM, held < step ? held : still + step);
      if (still < CALM) return;
      clearInterval(timer);
      finish('done');
    }, READ_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<section aria-label="Hold still">
  <p>
    [PLACEHOLDER] The village shivers in the dark. Hold still for five seconds. Do not move the pointer, and
    do not press a key.
  </p>
  <div class="meter">
    <label for="stillness">Stillness</label>
    <progress id="stillness" max={CALM} value={still}></progress>
    <span>{Math.floor(still)} of {CALM} seconds</span>
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .meter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  /* The track has an outline in the text color, for 3:1 against the page. */
  progress {
    width: 12rem;
    height: 0.9rem;
    appearance: none;
    border: 2px solid var(--fg);
    border-radius: 0.45rem;
    background: var(--bg);
    overflow: hidden;
  }
  progress::-webkit-progress-bar {
    background: var(--bg);
  }
  progress::-webkit-progress-value {
    background: var(--accent);
  }
  progress::-moz-progress-bar {
    background: var(--accent);
  }
</style>
