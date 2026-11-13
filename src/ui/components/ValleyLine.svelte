<script lang="ts">
  import type { WorldLite } from '../../sim-host/protocol.ts';

  let { lite, label }: { lite: WorldLite | null; label: (id: string) => string } = $props();

  const percent = (share: number): string => `${String(Math.round(share * 100))}%`;

  /**
   * The valley's own line: in the Fen, Tove's perceived share (the reflection, ADR 0007) against the
   * share of the flock really in flight; in the Hollow, the gazette's last print. '' elsewhere.
   */
  const text = $derived.by(() => {
    const pack = lite?.pack;
    if (pack?.id === 'fen') {
      const flying = new Set(pack.flying);
      const flock = (lite?.creatures ?? []).filter((c) => c.speciesId === 'starling' && c.state !== 'away');
      const real = flock.length === 0 ? 0 : flock.filter((c) => flying.has(c.id)).length / flock.length;
      return `Tove sees ${percent(pack.perceived['tove'] ?? 0)} of its neighbors flying in the water; ${percent(real)} really fly.`;
    }
    if (pack?.id === 'hollow' && pack.front !== null) {
      // The hero goes by the name the player gave it.
      const front = pack.front === 'hero' && lite?.hero ? lite.hero.name : label(pack.front);
      return `The gazette: ${front} is on the front page.`;
    }
    return '';
  });
</script>

<!-- In the Fen and the Hollow from the first snapshot, so a screen reader announces each change. -->
{#if lite?.pack?.id === 'fen' || lite?.pack?.id === 'hollow'}
  <p class="valley" class:empty={!text} role="status">{text}</p>
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
</style>
