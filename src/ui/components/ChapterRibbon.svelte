<script lang="ts">
  import type { Chapter } from '../../story/schema.ts';
  import { chapterHeading } from '../chapter-label.ts';

  let { chapters, current, onSkip }: { chapters: readonly Chapter[]; current: number; onSkip: () => void } =
    $props();
</script>

<!-- Short marks on screen (a chapter's number, a dot for an interlude, a valley's title); the full name is read out. -->
<nav class="ribbon" aria-label="Chapters">
  <ol>
    {#each chapters as c, i (i)}
      <li aria-current={i === current ? 'step' : undefined}>
        <span aria-hidden="true"
          >{c.kind === 'interlude' ? '•' : c.kind === 'valley' ? c.title : c.id.replace(/^ch/, '')}</span
        >
        <span class="sr-only">{chapterHeading(c)}</span>
      </li>
    {/each}
  </ol>
  <button type="button" onclick={onSkip}>Skip chapter</button>
</nav>

<style>
  .ribbon {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.25rem 1rem;
    max-width: 100%;
    padding: 0.25rem 1rem;
    background: var(--bg);
  }
  ol {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    max-width: 100%;
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
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
