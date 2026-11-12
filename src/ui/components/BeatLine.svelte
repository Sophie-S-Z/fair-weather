<script lang="ts">
  let { lines }: { lines: readonly { id: number; text: string }[] } = $props();
</script>

<!-- One live region for the story lines, hints, and bet results; each new line is announced. -->
<div class="beat-line" aria-live="polite" aria-relevant="additions">
  {#each lines as line, i (line.id)}
    <p class:old={i < lines.length - 1}>{line.text}</p>
  {/each}
</div>

<style>
  .beat-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    max-width: 36rem;
  }
  p {
    margin: 0;
    padding: 0.4rem 1rem;
    background: var(--bg);
    border: 2px solid var(--accent);
    border-radius: 0.4rem;
  }
  p.old {
    border-color: transparent;
    font-size: 0.9em;
  }
</style>
