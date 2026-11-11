<script lang="ts">
  import { tick } from 'svelte';

  let { notes }: { notes: readonly string[] } = $props();

  let open = $state(false);
  let toggle: HTMLButtonElement;
  let panel: HTMLElement | undefined = $state();

  async function show(): Promise<void> {
    open = true;
    await tick();
    panel?.focus();
  }
  function hide(): void {
    open = false;
    toggle.focus();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    hide();
  }
</script>

<!-- The drawer on the right (spec 12.2): the chapter's margin notes, closed until opened. -->
<div class="drawer">
  <button
    type="button"
    aria-expanded={open}
    aria-controls="notes-drawer"
    bind:this={toggle}
    onclick={() => {
      if (open) hide();
      else void show();
    }}>Notes</button
  >
  {#if open}
    <!-- Escape from anywhere inside the open drawer closes it. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <section
      id="notes-drawer"
      class="panel"
      aria-labelledby="notes-title"
      tabindex="-1"
      bind:this={panel}
      onkeydown={onKey}
    >
      <h2 id="notes-title">Margin notes</h2>
      <ul>
        {#each notes as note (note)}<li>{note}</li>{/each}
      </ul>
      <button type="button" onclick={hide}>Close</button>
    </section>
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
    width: min(22rem, calc(100vw - 2rem));
    max-height: 60vh;
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
  ul {
    padding-left: 1.25rem;
  }
</style>
