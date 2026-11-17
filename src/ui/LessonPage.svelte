<script lang="ts">
  import type { Look } from '../render/table-view.ts';
  import type { Rig } from '../render/line/rig.ts';
  import { LESSON_LOOPS } from '../toy/lessons.ts';
  import LoopView from './LoopView.svelte';
  import StickerArt from './StickerArt.svelte';
  import type { Sticker } from './stickers.ts';

  interface Props {
    sticker: Sticker;
    rigs: ReadonlyMap<string, Rig>;
    look: Look;
    back: () => void;
    done: () => void;
  }
  const { sticker, rigs, look, back, done }: Props = $props();

  const loops = $derived(LESSON_LOOPS[sticker.id]);
  let picked = $state(0);
</script>

<article class="lesson">
  <div class="top">
    <button class="cutout" onclick={back}>All stickers</button>
    <button class="cutout" onclick={done}>Back to the table</button>
  </div>
  <div class="head">
    <StickerArt {sticker} size="5.5rem" />
    <h2 id="book-title">{sticker.title}</h2>
  </div>
  {#each sticker.lesson as sentence, i (i)}
    {@const loop = loops[i]}
    <p class="beat">{sentence}</p>
    {#if loop}
      {#if loop.variants.length > 1}
        <fieldset class="knob">
          <legend>{sticker.knob}</legend>
          {#each loop.variants as v, k (v.label)}
            <label class="cutout" class:on={picked === k}>
              <input type="radio" name="knob-{sticker.id}" value={k} bind:group={picked} />
              {v.label}
            </label>
          {/each}
        </fieldset>
      {/if}
      {@const variant = loop.variants[loop.variants.length > 1 ? picked : 0]}
      {#if variant}
        {#key variant}
          <LoopView setup={variant.setup} {rigs} {look} label={sentence} />
        {/key}
      {/if}
    {/if}
  {/each}
  <p class="try"><strong>Try this:</strong> {sticker.tryThis}</p>
</article>

<style>
  .lesson {
    padding: 1.4rem 1.6rem 1.8rem;
    max-width: 44rem;
    margin: 0 auto;
    overflow-y: auto;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    margin: 1.4rem 0 0.4rem;
  }
  h2 {
    font-size: 2.1rem;
  }
  .beat {
    font-size: 1.2rem;
    margin: 1.4rem 0 0.75rem;
    max-width: 36rem;
  }
  .knob {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    border: 0;
    padding: 0;
    margin: 0 0 0.75rem;
  }
  legend {
    float: left;
    margin-right: 0.5rem;
    color: var(--muted);
  }
  .knob label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.5rem;
    padding: 0.3rem 0.8rem;
    --lift: 3px;
  }
  .knob label.on {
    background: var(--gold);
  }
  .knob input {
    accent-color: var(--ink);
  }
  .try {
    margin-top: 1.8rem;
    padding: 0.9rem 1.1rem;
    border: 2px dashed var(--ink);
    border-radius: var(--scrap);
    font-size: 1.1rem;
  }
</style>
