<script lang="ts">
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { traceProgress } from './activities.ts';

  // Every activity takes the same props (Game.svelte); this one does not read the world.
  // eslint-disable-next-line svelte/no-unused-props
  let { finish }: { lite: WorldLite; finish: (result: string) => void } = $props();

  /**
   * [PLACEHOLDER] art: Wisp's path in a 140 by 80 box, drawn by hand in parts. Joined up, it
   * spells "home" (spec 6.4).
   */
  const PARTS = [
    [10, 10, 10, 70],
    [10, 70, 10, 46, 22, 38, 32, 46, 32, 70],
    [32, 70, 42, 56, 52, 42, 62, 56, 52, 70, 42, 56],
    [42, 56, 70, 70, 70, 46, 78, 40, 85, 46, 85, 70],
    [85, 70, 85, 46, 93, 40, 100, 46, 100, 70],
    [100, 70, 108, 58, 126, 58, 117, 44, 108, 58],
    [108, 58, 117, 70, 130, 66],
  ];
  const PATH = PARTS.flat();
  /** How near the path a traced point counts, in path units. */
  const TOLERANCE = 6;
  const DONE = 0.9;

  /** What the player traced: one line per drag, and one per part traced by keyboard. */
  let trails: number[][] = $state([]);
  let dragging = false;
  let nextPart = 0;
  let done = false;
  const progress = $derived(traceProgress(PATH, trails.flat(), TOLERANCE));

  function add(points: number[], fresh: boolean): void {
    if (done) return;
    trails = fresh ? [...trails, points] : [...trails.slice(0, -1), [...(trails.at(-1) ?? []), ...points]];
    if (traceProgress(PATH, trails.flat(), TOLERANCE) >= DONE) {
      done = true;
      finish('done');
    }
  }
  function at(e: PointerEvent): number[] {
    const svg = e.currentTarget as SVGSVGElement;
    const m = svg.getScreenCTM()?.inverse();
    if (!m) return [];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  }
  function onDown(e: PointerEvent): void {
    dragging = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    add(at(e), true);
  }
  function onMove(e: PointerEvent): void {
    if (dragging) add(at(e), false);
  }
  function traceNext(): void {
    const part = PARTS[nextPart];
    if (!part) return;
    nextPart += 1;
    add(part, true);
  }
</script>

<section aria-label="Wisp's path">
  <p>[PLACEHOLDER] Trace the path Wisp walked, with a finger or the pointer, or one part at a time.</p>
  <svg
    viewBox="0 0 140 80"
    role="img"
    aria-label="Wisp's path on the postcard"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
  >
    <polyline class="path" points={PATH.join(' ')} />
    {#each trails as trail, i (i)}
      <polyline class="trail" points={trail.join(' ')} />
    {/each}
  </svg>
  <p role="status">
    {trails.length === 0 ? '' : `${String(Math.round(progress * 100))}% of the path traced`}
  </p>
  <button type="button" onclick={traceNext}>Trace the next part</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  svg {
    width: min(21rem, 80vw);
    aspect-ratio: 140 / 80;
    /* Drags trace the path, not scroll the page. */
    touch-action: none;
    cursor: crosshair;
  }
  polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .path {
    stroke: var(--muted);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .trail {
    stroke: var(--accent);
    stroke-width: 3;
  }
</style>
