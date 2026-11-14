<script lang="ts">
  import { tick } from 'svelte';
  import type { Dials } from '../../sim/types.ts';
  import type { peekRule } from '../../story/peek.ts';
  import type { Note as NoteData } from '../../story/schema.ts';
  import Note from './Note.svelte';

  type Section = 'diary' | 'peek' | 'notes';

  let {
    notes,
    diary,
    openAt,
    open = $bindable(false),
    onBook,
    onJournal,
  }: {
    notes: readonly NoteData[];
    /** The picked creature's page, with display names; `peek` is null while peek is locked. */
    diary: {
      name: string;
      lines: readonly string[];
      /** True while the rest is a rewound world but the lines are now's. */
      linesNow: boolean;
      dials: Dials;
      friends: readonly string[];
      scars: readonly string[];
      peek: ReturnType<typeof peekRule> | null;
    } | null;
    /**
     * Each new value opens the drawer at its section (the first one when that is not shown). With
     * `focus`, the section takes focus, which goes back where it was when the drawer closes.
     */
    openAt: { section: Section; focus: boolean } | null;
    /** Whether the drawer is open; the screen keeps its other HUD clear of it. */
    open?: boolean;
    /** Opens the Book of Skies; the button shows only when this is given. */
    onBook?: (() => void) | undefined;
    /** Opens the travel journal; the button shows only when this is given (Part 2). */
    onJournal?: (() => void) | undefined;
  } = $props();

  const DIALS: readonly [keyof Dials, string][] = [
    ['opener', 'Opener'],
    ['forgiveness', 'Forgiveness'],
    ['memory', 'Memory'],
    ['ear', 'Ear'],
    ['wanderlust', 'Wanderlust'],
  ];

  let toggle: HTMLButtonElement;
  let panel: HTMLElement | undefined = $state();
  /** Where focus goes back to when the drawer closes. */
  let returnTo: HTMLElement | null = null;

  /** Each section shown now, by name. */
  const sections: Partial<Record<Section, HTMLElement>> = $state({});

  $effect(() => {
    if (openAt) void show(openAt.section, openAt.focus);
  });

  /** Opens the drawer and scrolls `section` to its top; see `openAt`. */
  async function show(section: Section, focus: boolean): Promise<void> {
    if (focus) {
      const from = document.activeElement;
      returnTo = from instanceof HTMLElement && from !== document.body ? from : toggle;
    }
    open = true;
    await tick();
    const el = sections[section] ?? sections[diary ? 'diary' : 'notes'];
    if (!panel || !el) return;
    panel.scrollTop = el.offsetTop;
    if (focus) el.focus({ preventScroll: true });
  }
  function hide(): void {
    open = false;
    (returnTo?.isConnected ? returnTo : toggle).focus();
    returnTo = null;
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    hide();
  }
  const two = (n: number): string => n.toFixed(2);
  const berries = (n: number): string => `${String(n)} ${n === 1 ? 'berry' : 'berries'}`;
</script>

<!--
  The drawer on the right (spec 12.2): the picked creature's diary, dials, and, once peek is
  unlocked, what is under the hood; then the chapter's margin notes. Closed until opened.
-->
<div class="drawer">
  <button
    type="button"
    aria-expanded={open}
    aria-controls="drawer-panel"
    bind:this={toggle}
    onclick={() => {
      if (open) hide();
      else void show(diary ? 'diary' : 'notes', true);
    }}>Diary and notes</button
  >
  {#if open}
    <!-- Escape from anywhere inside the open drawer closes it. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div id="drawer-panel" class="panel" bind:this={panel} onkeydown={onKey}>
      {#if diary}
        <section aria-labelledby="diary-title" tabindex="-1" bind:this={sections.diary}>
          <h2 id="diary-title">Diary: {diary.name}</h2>
          <p><strong>Friends:</strong> {diary.friends.length > 0 ? diary.friends.join(', ') : 'none'}</p>
          <p><strong>Scars:</strong> {diary.scars.length > 0 ? diary.scars.join(', ') : 'none'}</p>
          <h3 id="diary-lines">Lines, oldest first{diary.linesNow ? ' (now)' : ''}</h3>
          {#if diary.lines.length > 0}
            <ol aria-labelledby="diary-lines">
              {#each diary.lines as line, i (i)}
                <li>{line}</li>
              {/each}
            </ol>
          {:else}
            <p>Nothing written yet.</p>
          {/if}
        </section>
        <section aria-labelledby="dials-title">
          <h2 id="dials-title">Dials</h2>
          <dl>
            {#each DIALS as [key, label] (key)}
              <div>
                <dt>{label}</dt>
                <dd>{two(diary.dials[key])}</dd>
              </div>
            {/each}
          </dl>
        </section>
        {#if diary.peek}
          <section aria-labelledby="peek-title" tabindex="-1" bind:this={sections.peek}>
            <h2 id="peek-title">Under the hood</h2>
            <table>
              <caption>One gift</caption>
              <tbody>
                <tr><th scope="row">The giver pays</th><td>{berries(diary.peek.payoff.cost)}</td></tr>
                <tr><th scope="row">The receiver gets</th><td>{berries(diary.peek.payoff.value)}</td></tr>
              </tbody>
            </table>
            <ul>
              {#each diary.peek.lines as line, i (i)}
                <li>{line}</li>
              {/each}
            </ul>
          </section>
        {/if}
      {/if}
      <section aria-labelledby="notes-title" tabindex="-1" bind:this={sections.notes}>
        <h2 id="notes-title">Margin notes</h2>
        <!-- By index: two notes may share a title, and a note may list a source twice. -->
        {#each notes as note, i (i)}
          <Note {note} />
        {/each}
      </section>
      {#if onJournal}
        <button type="button" onclick={onJournal}>Travel journal</button>
      {/if}
      {#if onBook}
        <button type="button" onclick={onBook}>Book of Skies</button>
      {/if}
      <button type="button" onclick={hide}>Close</button>
    </div>
  {/if}
</div>

<style>
  .drawer {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .panel {
    /* Sections measure their offsets from the panel, which scrolls to them. */
    position: relative;
    width: min(22rem, calc(100vw - 2rem));
    /* Ends above the time controls, so they stay in reach at every text size. */
    max-height: calc(100vh - 10rem);
    box-sizing: border-box;
    overflow-y: auto;
    padding: 1rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  h2 {
    margin-top: 0;
    font-size: 1.1rem;
  }
  section + section {
    margin-top: 1rem;
  }
  h3 {
    margin-bottom: 0.25rem;
    font-size: 1rem;
  }
  ul,
  ol {
    padding-left: 1.25rem;
  }
  dl div {
    display: flex;
    justify-content: space-between;
  }
  dt,
  dd {
    margin: 0;
  }
  table {
    border-collapse: collapse;
  }
  caption {
    text-align: left;
    font-weight: bold;
  }
  th,
  td {
    padding: 0.1rem 0.5rem 0.1rem 0;
    text-align: left;
  }
</style>
