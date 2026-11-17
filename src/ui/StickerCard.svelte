<script lang="ts">
  import { onMount } from 'svelte';
  import type { StickerId } from '../toy/types.ts';
  import StickerArt from './StickerArt.svelte';
  import { stickerById } from './stickers.ts';

  interface Props {
    id: StickerId;
    open: () => void;
    close: () => void;
  }
  const { id, open, close }: Props = $props();
  const sticker = $derived(stickerById(id));

  /** Seconds the card stays before it tucks itself away. */
  const STAY = 9;
  onMount(() => {
    const timer = setTimeout(close, STAY * 1000);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<div class="card paper" role="status">
  <StickerArt {sticker} size="4.5rem" />
  <div>
    <p class="new">New sticker</p>
    <h2>{sticker.title}</h2>
    <p>{sticker.lesson[0]}</p>
    <div class="actions">
      <button class="cutout" onclick={open}>Read the page</button>
      <button class="cutout" onclick={close}>Keep playing</button>
    </div>
  </div>
</div>

<style>
  .card {
    position: fixed;
    top: 5rem;
    right: 1.5rem;
    width: min(25rem, calc(100vw - 3rem));
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.9rem;
    padding: 1rem;
    animation: arrive 420ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  .new {
    margin: 0;
    color: var(--berry);
    font-weight: 700;
  }
  h2 {
    font-size: 1.3rem;
    margin: 0.1rem 0 0.35rem;
  }
  p {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  @keyframes arrive {
    from {
      transform: translateY(-1.5rem) rotate(-4deg) scale(0.85);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
