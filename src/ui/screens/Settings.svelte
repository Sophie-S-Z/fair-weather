<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { Settings } from '../settings.ts';

  let { settings, onBack }: { settings: Writable<Settings>; onBack: () => void } = $props();

  /** The switch exists only in a build that names a server (ADR 0014 item 9). */
  const offerAnalytics = Boolean(import.meta.env.VITE_ANALYTICS_URL);

  function setScale(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = Number(e.currentTarget.value);
    if (v === 1 || v === 1.25 || v === 1.5) settings.update((s) => ({ ...s, textScale: v }));
  }
</script>

<h1>Settings</h1>
<div class="rows">
  <label>
    Text size
    <select value={String($settings.textScale)} onchange={setScale}>
      <option value="1">Normal</option>
      <option value="1.25">Large</option>
      <option value="1.5">Largest</option>
    </select>
  </label>
  <label>
    <input
      type="checkbox"
      checked={$settings.highContrast}
      onchange={(e) => {
        settings.update((s) => ({ ...s, highContrast: e.currentTarget.checked }));
      }}
    />
    High contrast
  </label>
  <label>
    <input
      type="checkbox"
      checked={$settings.reducedMotion}
      onchange={(e) => {
        settings.update((s) => ({ ...s, reducedMotion: e.currentTarget.checked }));
      }}
    />
    Reduced motion
  </label>
  <label>
    <input
      type="checkbox"
      checked={$settings.sound}
      onchange={(e) => {
        settings.update((s) => ({ ...s, sound: e.currentTarget.checked }));
      }}
    />
    Sound
  </label>
  {#if offerAnalytics}
    <div>
      <label>
        <input
          type="checkbox"
          checked={$settings.analytics}
          aria-describedby="analytics-line"
          onchange={(e) => {
            settings.update((s) => ({ ...s, analytics: e.currentTarget.checked }));
          }}
        />
        Send counts to help us make the game better
      </label>
      <p id="analytics-line">
        When this is on, the game sends only three counts: the chapters that you get to, the bets that you get
        right, and the minutes in the sandbox. It sends no names, no words that you write, and nothing that
        can identify you or this device.
      </p>
    </div>
  {/if}
  <button type="button" onclick={onBack}>Back</button>
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  p {
    margin: 0.25rem 0 0 1.75rem;
  }
  select {
    font: inherit;
    margin-left: 0.5rem;
  }
  input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    margin-right: 0.5rem;
  }
</style>
