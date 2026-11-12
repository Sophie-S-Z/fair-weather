<script lang="ts">
  let {
    hasSave,
    onBegin,
    onContinue,
    onSettings,
  }: { hasSave: boolean; onBegin: () => void; onContinue: () => void; onSettings: () => void } = $props();
</script>

<h1>Fair Weather</h1>
<nav aria-label="Main menu">
  <button type="button" onclick={onBegin}>Begin</button>
  <button type="button" disabled={!hasSave} onclick={onContinue}>Continue</button>
  <button type="button" disabled>Book of Skies</button>
  <button type="button" onclick={onSettings}>Settings</button>
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
