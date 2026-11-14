<script lang="ts">
  import type { Note } from '../../story/schema.ts';

  let { note, level = 3 }: { note: Note; /** The heading level of the note's title. */ level?: 3 | 4 } =
    $props();
</script>

<!-- A margin note (spec 10.5): the science, its limits, the counter-view, an open question, and sources. -->
<article>
  <svelte:element this={`h${String(level)}`}>{note.title}</svelte:element>
  <p>{note.science}</p>
  <p><strong>Limits:</strong> {note.limits}</p>
  <p><strong>Counter-view:</strong> {note.counter}</p>
  <p><strong>Open question:</strong> {note.question}</p>
  <ul aria-label="Sources">
    {#each note.sources as source, j (j)}
      <li><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>
    {/each}
  </ul>
</article>

<style>
  article > :global(h3),
  article > :global(h4) {
    margin-bottom: 0.25rem;
    font-size: 1rem;
  }
  a {
    color: inherit;
  }
  ul {
    padding-left: 1.25rem;
  }
</style>
