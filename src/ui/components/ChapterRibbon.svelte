<script lang="ts">
  let { count, current, onSkip }: { count: number; current: number; onSkip: () => void } = $props();
</script>

<nav class="ribbon" aria-label="Chapters">
  <ol>
    {#each { length: count }, i (i)}
      <li aria-current={i === current ? 'step' : undefined}>Chapter {i}</li>
    {/each}
  </ol>
  <button type="button" onclick={onSkip}>Skip chapter</button>
</nav>

<style>
  .ribbon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.25rem 1rem;
    background: var(--bg);
  }
  ol {
    display: flex;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
  }
  li[aria-current='step'] {
    color: var(--fg);
    font-weight: bold;
    text-decoration: underline;
  }
  button {
    min-height: 2rem;
    padding: 0.25rem 0.75rem;
  }
</style>
