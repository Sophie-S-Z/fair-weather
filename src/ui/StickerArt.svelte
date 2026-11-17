<script lang="ts">
  import { creatureArt, PROP_ART } from './art.ts';
  import type { Sticker } from './stickers.ts';

  interface Props {
    sticker: Sticker;
    size: string;
  }
  const { sticker, size }: Props = $props();
</script>

<!-- A round die-cut sticker: the creature in front, its prop tucked behind. -->
<div class="sticker" style:--size={size} aria-hidden="true">
  {#if sticker.art.prop}
    <span class="prop">{@html PROP_ART[sticker.art.prop]}</span>
  {/if}
  <span class="who">{@html creatureArt(sticker.art.cast)}</span>
</div>

<style>
  .sticker {
    position: relative;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--gold);
    border: var(--edge) solid var(--ink);
    box-shadow: 0 0 0 0.3rem var(--paper);
    overflow: hidden;
  }
  .who :global(svg) {
    position: absolute;
    left: 8%;
    bottom: -4%;
    width: 72%;
    height: 72%;
  }
  .prop :global(svg) {
    position: absolute;
    right: 2%;
    top: 6%;
    width: 52%;
    height: 52%;
  }
</style>
