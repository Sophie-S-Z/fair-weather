<script lang="ts">
  import { traceProgress } from './activities.ts';

  let { finish }: { finish: (result: string) => void } = $props();

  /**
   * Wisp's path in a 140 by 80 box, drawn by hand in parts. It reads as a trail that climbs over
   * the ridge, rounds a pond, crosses two hills, and curls to a house. Traced, it spells "home" in
   * joined letters: h, o, the two arches of m, and e with its tail (spec 6.4).
   */
  const PARTS = [
    [
      4, 74, 5, 74, 7, 72, 9, 70, 11, 68, 13, 62, 16, 56, 18, 48, 20, 40, 22, 32, 22, 26, 23, 20, 22, 15, 21,
      12, 19, 10, 17, 10, 15, 11, 14, 15, 13, 21, 13, 30, 14, 40, 14, 52, 15, 64, 15, 70,
    ],
    [
      15, 70, 15, 67, 16, 61, 17, 56, 19, 52, 22, 49, 24, 48, 27, 48, 30, 50, 31, 53, 32, 58, 32, 62, 32, 65,
      33, 68, 34, 70, 36, 70, 39, 70, 40, 69,
    ],
    [
      40, 69, 41, 66, 42, 62, 44, 57, 47, 54, 50, 52, 52, 51, 55, 52, 56, 55, 57, 58, 56, 62, 55, 65, 52, 68,
      50, 69, 46, 69, 44, 68, 43, 64, 43, 61, 44, 58, 47, 55, 50, 53, 54, 52, 56, 52, 59, 53, 62, 54, 63, 55,
    ],
    [
      63, 55, 63, 57, 64, 60, 64, 64, 64, 68, 64, 67, 65, 62, 66, 57, 68, 54, 70, 52, 73, 51, 75, 52, 76, 55,
      77, 60, 77, 66, 77, 70,
    ],
    [
      77, 70, 77, 67, 78, 61, 79, 56, 81, 54, 83, 52, 86, 51, 88, 52, 89, 55, 90, 58, 90, 63, 91, 66, 92, 69,
      94, 70, 97, 69, 98, 69,
    ],
    [
      98, 69, 100, 68, 102, 65, 106, 63, 108, 60, 110, 58, 112, 55, 111, 53, 109, 51, 106, 50, 104, 52, 102,
      54, 100, 57, 100, 61, 102, 64, 104, 67, 106, 69, 110, 70, 114, 69, 118, 68, 122, 66, 126, 64, 129, 61,
      132, 60, 135, 58, 136, 58,
    ],
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
  <p class="card">
    Wisp writes: I walked this path the long way round. Follow it, and you will see what I mean.
  </p>
  <p>Trace the path with a finger or the pointer, or trace one part at a time.</p>
  <svg
    viewBox="0 0 140 80"
    role="img"
    aria-label="Wisp's path on the postcard"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
  >
    <!-- The land under the trail: the ridge Wisp crossed, a pond, and a house at the end. -->
    <path class="land" d="M0 30 L10 22 L18 26 L30 14 L40 24 L48 20 L60 30" />
    <ellipse class="land" cx="49" cy="61" rx="3.5" ry="2.5" />
    <path class="land" d="M126 58 L126 50 L131 45 L136 50 L136 58 Z M130 58 L130 54 L132 54 L132 58" />
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
  polyline,
  .land {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .land {
    stroke: var(--muted);
    stroke-width: 1;
    opacity: 0.6;
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
