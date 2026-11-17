<script lang="ts">
  import { onMount } from 'svelte';
  import { Application } from 'pixi.js';
  import { PALETTE } from '../render/palette.ts';
  import type { Rig } from '../render/line/rig.ts';
  import { createTableView, type Look, type Rect } from '../render/table-view.ts';
  import { LOOP_HOLD, LOOP_MAX, type LoopSetup } from '../toy/lessons.ts';
  import { createTable } from '../toy/table.ts';
  import type { Table } from '../toy/types.ts';
  import { runFrames } from './frame.ts';

  interface Props {
    setup: LoopSetup;
    rigs: ReadonlyMap<string, Rig>;
    look: Look;
    /** The sentence the loop acts out, for screen readers. */
    label: string;
  }
  const { setup, rigs, look, label }: Props = $props();

  /** The loop's drawing size in CSS pixels; the page scales it to fit. */
  const WIDTH = 560;
  const HEIGHT = 340;

  let canvas: HTMLCanvasElement;
  let finished = $state(false);

  /** The part of the table the loop shows: its cast and props with room for hops and bubbles. */
  function frameOf(s: LoopSetup): Rect {
    const xs = [...s.cast.map((c) => c[1]), ...(s.props ?? []).map((p) => p[1])];
    const ys = [...s.cast.map((c) => c[2]), ...(s.props ?? []).map((p) => p[2])];
    const tall = (s.props ?? []).some((p) => p[0] === 'lamp') ? 300 : 190;
    const wide = (s.props ?? []).some((p) => p[0] === 'track') ? 340 : 170;
    let x0 = Math.min(...xs) - wide;
    let x1 = Math.max(...xs) + wide;
    let y0 = Math.min(...ys) - tall;
    let y1 = Math.max(...ys) + 45;
    const aspect = WIDTH / HEIGHT;
    if ((x1 - x0) / (y1 - y0) < aspect) {
      const grow = ((y1 - y0) * aspect - (x1 - x0)) / 2;
      x0 -= grow;
      x1 += grow;
    } else {
      const grow = ((x1 - x0) / aspect - (y1 - y0)) / 2;
      y0 -= grow;
      y1 += grow;
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  onMount(() => {
    const app = new Application();
    let stop = (): void => undefined;
    let alive = true;
    let table: Table;
    let cues: NonNullable<LoopSetup['cues']>[number][] = [];
    let endedAt: number | null = null;
    let ready = false;

    const fresh = (): void => {
      table = createTable({ seed: 1, ...setup, wander: false });
      table.calm = look.reducedMotion;
      cues = [...(setup.cues ?? [])];
      endedAt = null;
      finished = false;
    };
    fresh();

    void app
      .init({
        canvas,
        width: WIDTH,
        height: HEIGHT,
        background: PALETTE.page,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio),
        autoDensity: true,
      })
      .then(() => {
        ready = true;
        if (!alive) {
          app.destroy(false, { children: true });
          return;
        }
        const view = createTableView(rigs);
        view.fit(WIDTH, HEIGHT, frameOf(setup));
        app.stage.addChild(view.container);
        let sawScene = false;
        stop = runFrames(app.ticker, view, {
          table: () => table,
          look: () => look,
          beforeStep: (t) => {
            while (cues[0] && cues[0].at <= t.time) cues.shift()?.act(t);
            if (t.scene) sawScene = true;
            else if (sawScene && endedAt === null) endedAt = t.time;
            const over = (endedAt !== null && t.time - endedAt > LOOP_HOLD) || t.time > LOOP_MAX;
            if (!over) return;
            if (look.reducedMotion) {
              finished = true;
              app.ticker.stop();
              app.render();
            } else {
              sawScene = false;
              fresh();
            }
          },
        });
        restart = () => {
          sawScene = false;
          fresh();
          app.ticker.start();
        };
      });

    return () => {
      alive = false;
      stop();
      if (ready) app.destroy(false, { children: true });
    };
  });

  let restart = $state<() => void>(() => undefined);
</script>

<figure class="loop">
  <div class="frame" role="img" aria-label={label}><canvas bind:this={canvas}></canvas></div>
  {#if finished}
    <button class="cutout replay" onclick={restart}>Play again</button>
  {/if}
</figure>

<style>
  .loop {
    position: relative;
    margin: 0;
  }
  .frame {
    width: 100%;
    aspect-ratio: 560 / 340;
    border: var(--edge) solid var(--ink);
    border-radius: var(--scrap);
    overflow: hidden;
    background: var(--floor);
  }
  .frame :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
  .replay {
    position: absolute;
    right: 0.8rem;
    bottom: 0.8rem;
  }
</style>
