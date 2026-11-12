<script lang="ts">
  let {
    hasSave,
    hasBook,
    onBegin,
    onContinue,
    onBook,
    onSettings,
  }: {
    hasSave: boolean;
    /** True when the Book of Skies has at least one page. */
    hasBook: boolean;
    onBegin: () => void;
    onContinue: () => void;
    onBook: () => void;
    onSettings: () => void;
  } = $props();
</script>

<h1>Fair Weather</h1>
<nav aria-label="Main menu">
  <button type="button" onclick={onBegin}>Begin</button>
  <button type="button" disabled={!hasSave} onclick={onContinue}>Continue</button>
  <button type="button" disabled={!hasBook} onclick={onBook}>Book of Skies</button>
  <button type="button" onclick={onSettings}>Settings</button>
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
