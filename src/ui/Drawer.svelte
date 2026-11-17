<script lang="ts">
  import { PROP_KINDS, STICKER_IDS, type PropKind, type StickerId } from '../toy/types.ts';
  import { PROP_ART, TOOL_ART, type Tool } from './art.ts';
  import { PROP_NAMES } from './props.ts';
  import { stickerById } from './stickers.ts';

  interface Props {
    /** The drawer's height in pixels, for the table to stay clear of it. */
    height?: number;
    tool: Tool;
    placed: readonly PropKind[];
    found: readonly StickerId[];
    /** What the yarn or scissors needs next; empty with the hand. */
    hint: string;
    choose: (tool: Tool) => void;
    toggle: (kind: PropKind) => void;
  }
  let { height = $bindable(0), tool, placed, found, hint, choose, toggle }: Props = $props();

  const TOOLS: readonly { id: Tool; name: string }[] = [
    { id: 'hand', name: 'Hand' },
    { id: 'yarn', name: 'Yarn' },
    { id: 'scissors', name: 'Scissors' },
  ];

  const next = $derived(STICKER_IDS.find((id) => !found.includes(id)));
  const riddle = $derived(next ? stickerById(next).riddle : 'Every sticker found. Play on.');
</script>

<section class="drawer paper" aria-label="Drawer" bind:clientHeight={height}>
  <p class="riddle" aria-live="polite">{hint || riddle}</p>
  <div class="rows">
    <div class="tools" role="radiogroup" aria-label="Tools">
      {#each TOOLS as t (t.id)}
        <button
          class="cutout item"
          role="radio"
          aria-checked={tool === t.id}
          onclick={() => {
            choose(t.id);
          }}
        >
          {@html TOOL_ART[t.id]}
          <span>{t.name}</span>
        </button>
      {/each}
    </div>
    <div class="props" role="group" aria-label="Props">
      {#each PROP_KINDS as kind (kind)}
        <button
          class="cutout item"
          aria-pressed={placed.includes(kind)}
          onclick={() => {
            toggle(kind);
          }}
        >
          {@html PROP_ART[kind]}
          <span>{PROP_NAMES[kind]}</span>
        </button>
      {/each}
    </div>
  </div>
</section>

<style>
  .drawer {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    width: min(72rem, calc(100vw - 1.5rem));
    padding: 0.6rem 0.9rem 0.85rem;
  }
  .riddle {
    margin: 0 0 0.55rem;
    min-height: 1.45em;
    text-align: center;
    color: var(--muted);
  }
  .rows {
    display: flex;
    justify-content: safe center;
    gap: 1.25rem;
    overflow-x: auto;
    padding: 0.2rem 0.4rem 0.5rem 0.1rem;
  }
  .tools,
  .props {
    display: flex;
    gap: 0.55rem;
  }
  .tools {
    padding-right: 1.25rem;
    border-right: 2px dashed var(--ink);
  }
  .item {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    width: 4.9rem;
    padding: 0.35rem 0.3rem;
    font-size: 0.85rem;
    line-height: 1.15;
  }
  .item :global(svg) {
    width: 2.2rem;
    height: 2.2rem;
  }
</style>
