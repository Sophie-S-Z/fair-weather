<script lang="ts">
  let {
    speed,
    disabled,
    onPause,
    onSpeed,
  }: { speed: number; disabled: boolean; onPause: () => void; onSpeed: (m: number) => void } = $props();
</script>

<div class="time" role="group" aria-label="Time">
  <button type="button" aria-pressed={speed === 0} {disabled} onclick={onPause}>Pause</button>
  <button
    type="button"
    aria-pressed={speed === 1}
    {disabled}
    onclick={() => {
      onSpeed(1);
    }}>1×</button
  >
  <button
    type="button"
    aria-pressed={speed === 2}
    {disabled}
    onclick={() => {
      onSpeed(2);
    }}>2×</button
  >
</div>

<style>
  .time {
    display: flex;
    gap: 0.5rem;
  }
  button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--bg);
  }
</style>
