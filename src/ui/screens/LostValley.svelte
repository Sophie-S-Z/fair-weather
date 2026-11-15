<script lang="ts">
  import { onMount } from 'svelte';

  let { onStartFresh }: { onStartFresh: () => void } = $props();

  let heading: HTMLElement;
  // The page replaces the sandbox, so its heading takes the focus and is read first.
  onMount(() => {
    heading.focus();
  });
</script>

<!-- An old or broken seed link or valley file (spec 12.8, ADR 0014 item 7). -->
<h1 tabindex="-1" bind:this={heading}>This valley could not be found</h1>
<p>The link or the file is damaged, or a different version of the game made it.</p>
<button type="button" onclick={onStartFresh}>Start fresh</button>
