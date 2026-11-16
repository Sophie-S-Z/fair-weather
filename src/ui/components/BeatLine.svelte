<script lang="ts">
  let {
    lines,
    fixed = false,
  }: {
    lines: readonly { id: number; text: string }[];
    /** The strip has one fixed height (portrait, where it must not resize the scene), else a ceiling. */
    fixed?: boolean;
  } = $props();

  let el: HTMLElement | undefined = $state();
  /** The lines are taller than the strip: it scrolls, so the keyboard needs to reach it. */
  let scrolls = $state(false);
  /** Lines are above the top of the strip: the top edge fades, so no line shows cut in half. */
  let above = $state(false);
  const measure = (): void => {
    if (!el) return;
    scrolls = el.scrollHeight > el.clientHeight;
    above = el.scrollTop > 0;
  };
  $effect(() => {
    // Each new line scrolls into view; the focus stays where it is.
    const count = lines.length;
    if (el && count > 0) el.scrollTop = el.scrollHeight;
    measure();
  });
  $effect(() => {
    if (!el) return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  });
</script>

<!-- One live region for the story lines, hints, and bet results; each new line is announced. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="beat-line"
  class:fixed
  class:above
  bind:this={el}
  onscroll={measure}
  aria-live="polite"
  aria-relevant="additions"
  role="group"
  aria-label="Story lines"
  tabindex={scrolls ? 0 : undefined}
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
  /* A strip that scrolls: the lines of the chapter stay readable. */
  .beat-line {
    box-sizing: border-box;
    max-height: 6rem;
    overflow-y: auto;
  }
  .beat-line p {
    flex: none;
  }
  .above {
    mask-image: linear-gradient(to bottom, transparent, #000 1.5rem);
  }
  .fixed {
    height: 6rem;
    max-width: none;
    align-items: stretch;
    background: var(--bg);
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
