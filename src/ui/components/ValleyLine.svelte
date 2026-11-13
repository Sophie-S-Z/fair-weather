<script lang="ts">
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import { valleyLine } from '../valley-line.ts';

  let { lite, label }: { lite: WorldLite | null; label: (id: string) => string } = $props();

  const line = $derived(valleyLine(lite, label));
</script>

<!-- In the Fen and the Hollow only. The line is plain text; a hidden live region says it, in the Fen
     in steps of 10%, so the flock's every move does not re-read it (as Postcard.svelte does). -->
{#if line}
  <p class="valley" class:empty={!line.text}>{line.text}</p>
  <p class="sr-only" role="status">{line.spoken}</p>
{/if}

<style>
  .valley {
    margin: 0;
    padding: 0 0.5rem;
    background: var(--bg);
  }
  .valley.empty {
    padding: 0;
    background: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
