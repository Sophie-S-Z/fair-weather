<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { Settings } from './settings.ts';

  interface Props {
    open: boolean;
    settings: Writable<Settings>;
    close: () => void;
  }
  const { open, settings, close }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  const SIZES = [
    { value: 1, name: 'Normal' },
    { value: 1.25, name: 'Large' },
    { value: 1.5, name: 'Largest' },
  ] as const;

  const SWITCHES = [
    { key: 'sound', name: 'Sound' },
    { key: 'reducedMotion', name: 'Reduced motion' },
    { key: 'highContrast', name: 'High contrast' },
  ] as const;
</script>

<dialog bind:this={dialog} class="paper" aria-labelledby="settings-title" onclose={close}>
  <div class="body">
    <h2 id="settings-title">Settings</h2>
    <fieldset>
      <legend>Text size</legend>
      {#each SIZES as size (size.value)}
        <label>
          <input
            type="radio"
            name="text-size"
            checked={$settings.textScale === size.value}
            onchange={() => {
              settings.update((s) => ({ ...s, textScale: size.value }));
            }}
          />
          {size.name}
        </label>
      {/each}
    </fieldset>
    {#each SWITCHES as sw (sw.key)}
      <label class="switch">
        <input
          type="checkbox"
          checked={$settings[sw.key]}
          onchange={(e) => {
            settings.update((s) => ({ ...s, [sw.key]: e.currentTarget.checked }));
          }}
        />
        {sw.name}
      </label>
    {/each}
    <h3>How to play</h3>
    <ul>
      <li>Drag a creature to carry it. Press and let go to poke it.</li>
      <li>Pick the yarn, then two creatures, to tie them. The scissors cut a tie the same way.</li>
      <li>Open the drawer for props. Drag a prop to move it. Press the lamp or the lever to flip it.</li>
      <li>
        With the keyboard: Tab to a creature. Enter lifts or drops it, the arrow keys carry it, and Space
        pokes it.
      </li>
    </ul>
    <button class="cutout" onclick={close}>Done</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100vw - 2rem));
  }
  .body {
    padding: 1.4rem 1.6rem 1.6rem;
    display: grid;
    gap: 0.9rem;
    justify-items: start;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
  }
  legend {
    font-weight: 700;
    margin-bottom: 0.3rem;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
  }
  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--ink);
  }
  h3 {
    margin-top: 0.4rem;
  }
  ul {
    margin: 0;
    padding-left: 1.2rem;
  }
  li + li {
    margin-top: 0.35rem;
  }
</style>
