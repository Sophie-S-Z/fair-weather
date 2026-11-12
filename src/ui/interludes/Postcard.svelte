<script lang="ts">
  import { traceProgress } from './activities.ts';

  let { finish }: { finish: (result: string) => void } = $props();

  /**
   * [PLACEHOLDER] art: Wisp's path in a 140 by 80 box, drawn by hand in parts: the stem and arch
   * of an h, a round o, the two arches of an m, and an e. Together they spell "home" (spec 6.4).
   */
  const PARTS = [
    [10, 8, 10, 70],
    [10, 48, 16, 40, 24, 38, 31, 42, 33, 50, 33, 70],
    [52, 44, 60, 47, 64, 56, 60, 65, 52, 68, 44, 65, 40, 56, 44, 47, 52, 44],
    [72, 70, 72, 46, 72, 50, 78, 43, 84, 44, 87, 50, 87, 70],
    [87, 50, 93, 43, 99, 44, 102, 50, 102, 70],
    [110, 57, 128, 57, 127, 51, 122, 45, 116, 44, 111, 48, 109, 56, 111, 64, 117, 68, 124, 68, 129, 64],
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
  /** The share traced, in steps of a quarter, so the status line speaks only at each step. */
  const quarter = $derived(Math.floor(traceProgress(PATH, trails.flat(), TOLERANCE) * 4) * 25);

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
  <p class="card">[PLACEHOLDER] Wisp writes: I walked this path. Follow it, and see where it goes.</p>
  <p>[PLACEHOLDER] Trace the path with a finger or the pointer, or trace one part at a time.</p>
  <svg
    viewBox="0 0 140 80"
    role="img"
    aria-label="Wisp's path on the postcard"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
  >
    {#each PARTS as part, i (i)}
      <polyline class="path" points={part.join(' ')} />
    {/each}
    {#each trails as trail, i (i)}
      <polyline class="trail" points={trail.join(' ')} />
    {/each}
  </svg>
  <p role="status">
    {trails.length === 0 ? '' : `${String(quarter)}% of the path traced`}
  </p>
  <button type="button" onclick={traceNext}>Trace the next part</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .card {
    font-style: italic;
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
