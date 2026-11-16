<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { KeptLink } from '../../persist/profile.ts';
  import { remixTree } from '../remix-tree.ts';
  import type { RemixNode } from '../remix-tree.ts';
  import { readValleyFile, saveFile } from '../save-file.ts';
  import { trapFocus } from '../trap-focus.ts';

  let {
    shared,
    valleyFile,
    kept,
    valleyName,
    onOpen,
    onClose,
  }: {
    /** What Share gave (ADR 0014 item 7): a link, the text of a valley file, or a run too long for either. */
    shared:
      | { kind: 'link'; url: string }
      | { kind: 'file'; text: string }
      | { kind: 'tooOld' }
      | { kind: 'tooBig' };
    /** The name a valley file saves under, and the most bytes of one that the game reads. */
    valleyFile: { name: string; maxBytes: number };
    /** The links the player made or opened, oldest first, for the remix tree (ADR 0015 item 10). */
    kept: readonly KeptLink[];
    valleyName: (valley: KeptLink['valley']) => string;
    /** Opens the `v1.<data>` text of a valley file the player picked, or of a kept link. */
    onOpen: (text: string) => void;
    onClose: () => void;
  } = $props();

  let card: HTMLElement;
  /** The line under Copy the link, in a status region. */
  let copied = $state('');
  const tree = $derived(remixTree(kept));

  // Focus moves in on open, and back to where it was (the Share button) on close.
  onMount(() => {
    const back = document.activeElement;
    card.querySelector<HTMLElement>('input, button')?.focus();
    // After the update that closes the panel, so the screen behind it is no longer inert.
    return () => {
      void tick().then(() => {
        if (back instanceof HTMLElement && back.isConnected) back.focus();
      });
    };
  });

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      copied = 'The link is copied.';
    } catch {
      copied = 'The link is not copied. Select the link and copy it.';
    }
  }

  async function pick(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
    const text = await readValleyFile(e.currentTarget, valleyFile.maxBytes);
    if (text !== null) onOpen(text);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }
</script>

<div class="backdrop">
  <div
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="share-title"
    tabindex="-1"
    bind:this={card}
    onkeydown={onKey}
    use:trapFocus
  >
    <h2 id="share-title">Share this valley</h2>
    {#if shared.kind === 'link'}
      {@const url = shared.url}
      <label for="share-link">Link to this valley</label>
      <input
        id="share-link"
        type="text"
        readonly
        value={url}
        onfocus={(e) => {
          e.currentTarget.select();
        }}
      />
      <button
        type="button"
        onclick={() => {
          void copy(url);
        }}>Copy the link</button
      >
      <p role="status">{copied}</p>
    {:else if shared.kind === 'file'}
      {@const text = shared.text}
      <p>This valley is too large for a link. Save it as a file.</p>
      <button
        type="button"
        onclick={() => {
          saveFile(new Blob([`${text}\n`], { type: 'application/octet-stream' }), valleyFile.name);
        }}>Save the file</button
      >
    {:else if shared.kind === 'tooOld'}
      <p>A link can hold at most 100 days. Start the valley again to share it.</p>
    {:else}
      <p>This valley holds too many changes for a link. Start the valley again to share it.</p>
    {/if}
    {#snippet branch(nodes: RemixNode[])}
      <ul>
        {#each nodes as { link, children } (link.id)}
          {@const what = `${valleyName(link.valley)}, day ${String(link.day + 1)}`}
          <li>
            <span class="node">
              {what}
              <button
                type="button"
                aria-label="Open {what}"
                onclick={() => {
                  onOpen(link.text);
                }}>Open</button
              >
            </span>
            {#if children.length > 0}
              {@render branch(children)}
            {/if}
          </li>
        {/each}
      </ul>
    {/snippet}
    {#if kept.length > 0}
      <section class="tree" aria-labelledby="tree-title">
        <h3 id="tree-title">Remix tree</h3>
        {#if tree.own.length > 0}
          {@render branch(tree.own)}
        {/if}
        {#if tree.others.length > 0}
          <p>A valley someone else made</p>
          {@render branch(tree.others)}
        {/if}
      </section>
    {/if}
    <div class="open">
      <label for="share-open">Open a valley file</label>
      <input id="share-open" type="file" accept=".fairweather" onchange={pick} />
    </div>
    <button type="button" onclick={onClose}>Close</button>
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 1.5rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 0;
  }
  #share-link {
    width: 100%;
    box-sizing: border-box;
    min-height: 2.75rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 2px solid var(--muted);
    border-radius: 0.4rem;
  }
  .tree {
    align-self: stretch;
    max-height: 14rem;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 1em;
  }
  .tree ul {
    margin: 0;
    padding-left: 1.1rem;
    list-style: none;
    border-left: 1px solid var(--muted);
  }
  .tree > ul {
    padding-left: 0;
    border-left: 0;
  }
  .node {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }
  /* Below 600 pixels the panel is a full-screen sheet (ADR 0014 item 15). */
  @media (max-width: 599.98px) {
    .card {
      width: 100vw;
      max-height: none;
      height: 100vh;
      height: 100dvh;
      border-width: 0;
      border-radius: 0;
    }
  }
</style>
