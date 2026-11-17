<script lang="ts">
  import type { Look } from '../render/table-view.ts';
  import type { Rig } from '../render/line/rig.ts';
  import type { StickerId } from '../toy/types.ts';
  import LessonPage from './LessonPage.svelte';
  import StickerArt from './StickerArt.svelte';
  import { BOOK } from './stickers.ts';

  interface Props {
    open: boolean;
    page: StickerId | null;
    found: readonly StickerId[];
    rigs: ReadonlyMap<string, Rig>;
    look: Look;
    show: (id: StickerId | null) => void;
    close: () => void;
    startOver: () => void;
  }
  const { open, page, found, rigs, look, show, close, startOver }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let sure = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  const shown = $derived(page && found.includes(page) ? BOOK.stickers.find((s) => s.id === page) : undefined);
</script>

<dialog
  bind:this={dialog}
  class="paper"
  aria-labelledby="book-title"
  onclose={() => {
    sure = false;
    close();
  }}
>
  {#if shown}
    {#key shown.id}
      <LessonPage
        sticker={shown}
        {rigs}
        {look}
        back={() => {
          show(null);
        }}
        done={close}
      />
    {/key}
  {:else}
    <div class="book">
      <div class="top">
        <h2 id="book-title">Sticker book</h2>
        <button class="cutout" onclick={close}>Back to the table</button>
      </div>
      <p class="lead">Each riddle hides one idea in the toybox. Find it on the table to get its sticker.</p>
      {#each BOOK.themes as theme (theme.id)}
        <section aria-labelledby="theme-{theme.id}">
          <h3 id="theme-{theme.id}">{theme.title}</h3>
          <ul>
            {#each BOOK.stickers.filter((s) => s.theme === theme.id) as s (s.id)}
              <li>
                {#if found.includes(s.id)}
                  <button
                    class="slot found"
                    onclick={() => {
                      show(s.id);
                    }}
                  >
                    <StickerArt sticker={s} size="4rem" />
                    <span class="title">{s.title}</span>
                  </button>
                {:else}
                  <div class="slot empty">
                    <span class="hole" aria-hidden="true">?</span>
                    <span><span class="sr-only">Not found yet. Riddle: </span>{s.riddle}</span>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
      <div class="end">
        {#if found.length > 0}
          <button
            class="cutout"
            onclick={() => {
              if (sure) {
                startOver();
                sure = false;
              } else sure = true;
            }}>{sure ? 'Press again to clear every sticker' : 'Start over'}</button
          >
        {/if}
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(56rem, calc(100vw - 2rem));
  }
  .book {
    padding: 1.4rem 1.6rem 1.6rem;
    overflow-y: auto;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 2rem;
  }
  .lead {
    margin: 0.5rem 0 1.2rem;
    color: var(--muted);
    max-width: 38rem;
  }
  section {
    margin-top: 1.1rem;
  }
  h3 {
    font-size: 1.15rem;
    margin-bottom: 0.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.75rem;
  }
  .slot {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.8rem;
    width: 100%;
    min-height: 5.2rem;
    padding: 0.55rem 0.8rem;
    text-align: left;
    border-radius: var(--scrap);
  }
  .found {
    background: var(--paper);
    border: var(--edge) solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    cursor: pointer;
  }
  .found:hover .title {
    text-decoration: underline;
  }
  .title {
    font-weight: 700;
  }
  .empty {
    border: 2px dashed var(--muted);
    color: var(--muted);
  }
  .hole {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: 2px dashed var(--muted);
    font-size: 1.6rem;
    font-weight: 700;
  }
  .end {
    margin-top: 1.4rem;
    display: flex;
    justify-content: flex-end;
  }
</style>
