<script lang="ts">
  let {
    hasSave,
    hasBook,
    sandboxClosed,
    onBegin,
    onContinue,
    onBook,
    onSandbox,
    onSettings,
  }: {
    hasSave: boolean;
    /** True when the Book of Skies has at least one page. */
    hasBook: boolean;
    /** Why the Sandbox button is disabled (ADR 0014 item 1), or null while it opens. */
    sandboxClosed: string | null;
    onBegin: () => void;
    onContinue: () => void;
    onBook: () => void;
    onSandbox: () => void;
    onSettings: () => void;
  } = $props();
</script>

<h1>Fair Weather</h1>
<nav aria-label="Main menu">
  <button type="button" onclick={onBegin}>Begin</button>
  <button type="button" disabled={!hasSave} onclick={onContinue}>Continue</button>
  <button type="button" disabled={!hasBook} onclick={onBook}>Book of Skies</button>
  <button
    type="button"
    id="title-sandbox"
    disabled={sandboxClosed !== null}
    aria-describedby={sandboxClosed === null ? undefined : 'sandbox-closed'}
    onclick={onSandbox}>Sandbox</button
  >
  {#if sandboxClosed !== null}
    <p id="sandbox-closed" class="why">{sandboxClosed}</p>
  {/if}
  <button type="button" onclick={onSettings}>Settings</button>
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .why {
    margin: -0.5rem 0 0;
    color: var(--muted);
  }
</style>
