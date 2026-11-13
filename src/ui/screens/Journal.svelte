<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CAPTION_LENGTH, characters } from '../../story/journey.ts';
  import Note from '../components/Note.svelte';
  import { inSentence } from '../journal-pages.ts';
  import type { JournalEntry } from '../journal-pages.ts';

  let {
    entries,
    at = null,
    onCaption,
    onBack,
  }: {
    entries: readonly JournalEntry[];
    /** The valley whose page takes focus and scrolls into view; the title without one. */
    at?: string | null;
    /** Keeps the player's line for a valley's page. The line stays on the device. */
    onCaption: (valley: string, text: string) => void;
    onBack: () => void;
  } = $props();

  let root: HTMLElement | undefined = $state();
  /** The lines as typed, by valley; a line is kept when its field changes or the journal closes. */
  // The journal opens on a fixed set of pages, so the entries are read once.
  // svelte-ignore state_referenced_locally
  const lines: Record<string, string> = $state(Object.fromEntries(entries.map((e) => [e.valley, e.caption])));
  // svelte-ignore state_referenced_locally
  const kept: Record<string, string> = Object.fromEntries(entries.map((e) => [e.valley, e.caption]));

  function keep(valley: string): void {
    const line = lines[valley] ?? '';
    if (line === kept[valley]) return;
    kept[valley] = line;
    onCaption(valley, line);
  }
  /** At most CAPTION_LENGTH characters; an emoji counts as one. */
  function limit(valley: string): void {
    const line = lines[valley] ?? '';
    const chars = characters(line);
    if (chars.length > CAPTION_LENGTH) lines[valley] = chars.slice(0, CAPTION_LENGTH).join('');
  }
  function close(): void {
    for (const e of entries) keep(e.valley);
    onBack();
  }

  // Focus moves to the opened page (or the title); the dialog gives it back to where it was on close.
  onMount(() => {
    const back = document.activeElement;
    const target = at === null ? null : root?.querySelector<HTMLElement>(`[data-page="${CSS.escape(at)}"]`);
    (target ?? root?.querySelector<HTMLElement>('#journal-title'))?.focus();
    return () => {
      // After the update that closes the dialog, so the screen behind it is no longer inert.
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  /** Escape closes the dialog; Tab stays inside it. */
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [...(root?.querySelectorAll<HTMLElement>('button, input, a[href]') ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      const inside = items.some((b) => b === document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
</script>

<div class="backdrop">
  <div
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="journal-title"
    tabindex="-1"
    bind:this={root}
    onkeydown={onKey}
  >
    <h2 id="journal-title" tabindex="-1">Travel journal</h2>
    {#if entries.length === 0}
      <p>No page is written here yet. A page is written when you leave a valley.</p>
    {/if}
    {#each entries as entry (entry.valley)}
      <article aria-labelledby="page-{entry.valley}">
        <h3 id="page-{entry.valley}" tabindex="-1" data-page={entry.valley}>{entry.title}</h3>
        {#if entry.drawing}
          <img src={entry.drawing.src} alt={entry.drawing.alt} width="160" height="100" />
        {/if}
        {#if entry.keepsake}
          <p>
            {#if entry.keepsake.held}
              Keepsake: {entry.keepsake.label}
            {:else}
              An empty pressed shape where the {inSentence(entry.keepsake.label)} was
            {/if}
          </p>
        {/if}
        {#if entry.locals.length > 0}
          <ul aria-label="What the locals say">
            {#each entry.locals as line, i (i)}
              <li>{line}</li>
            {/each}
          </ul>
        {/if}
        <p class="stamp">{entry.stamp}</p>
        <p>
          <label for="line-{entry.valley}">Your line</label>
          <input
            id="line-{entry.valley}"
            type="text"
            autocomplete="off"
            aria-describedby="line-hint"
            bind:value={lines[entry.valley]}
            oninput={() => {
              limit(entry.valley);
            }}
            onchange={() => {
              keep(entry.valley);
            }}
          />
        </p>
        <h4>What they say about you</h4>
        <p>{entry.said}</p>
        {#each entry.notes as note, i (i)}
          <Note {note} level={4} />
        {/each}
      </article>
    {/each}
    {#if entries.length > 0}
      <p id="line-hint" class="hint">
        Your line has at most {CAPTION_LENGTH} characters. It stays on this device.
      </p>
    {/if}
    <button type="button" onclick={close}>Close</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.25);
  }
  .card {
    box-sizing: border-box;
    width: min(36rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  .card > :global(:first-child) {
    margin-top: 0;
  }
  article {
    margin: 1.5rem 0;
    padding-top: 0.5rem;
    border-top: 2px solid var(--muted);
  }
  article > :global(h3),
  article > :global(h4) {
    font-size: 1rem;
    margin: 0.75rem 0 0.25rem;
  }
  article :global(p) {
    margin: 0.25rem 0;
  }
  img {
    max-width: 100%;
    height: auto;
    background: #fff;
    border: 1px solid var(--muted);
  }
  ul {
    padding-left: 1.25rem;
  }
  input {
    box-sizing: border-box;
    width: 100%;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 2px solid var(--accent);
    border-radius: 0.4rem;
    padding: 0.4rem 0.6rem;
  }
  .stamp {
    font-weight: bold;
  }
  .hint {
    color: var(--muted);
  }
</style>
