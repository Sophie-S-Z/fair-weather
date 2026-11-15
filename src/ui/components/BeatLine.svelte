<script lang="ts">
  let {
    lines,
    strip = false,
  }: {
    lines: readonly { id: number; text: string }[];
    /** A strip of a fixed height that scrolls and takes focus, with the newest line in view (portrait). */
    strip?: boolean;
  } = $props();

  let el: HTMLElement | undefined = $state();
  $effect(() => {
    // Each new line scrolls into view.
    const count = lines.length;
    if (strip && el && count > 0) el.scrollTop = el.scrollHeight;
  });
</script>

<!-- One live region for the story lines, hints, and bet results; each new line is announced. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="beat-line"
  class:strip
  bind:this={el}
  aria-live="polite"
  aria-relevant="additions"
  role={strip ? 'group' : undefined}
  aria-label={strip ? 'Story lines' : undefined}
  tabindex={strip ? 0 : undefined}
>
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
  .strip {
    box-sizing: border-box;
    height: 6rem;
    max-width: none;
    overflow-y: auto;
    align-items: stretch;
    background: var(--bg);
  }
  .strip p {
    flex: none;
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
