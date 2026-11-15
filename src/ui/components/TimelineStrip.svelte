<script lang="ts">
  import { tick } from 'svelte';
  import type { TimelinePoint } from '../../render/timeline.ts';

  let {
    timeline,
    rewind,
    onRewind,
    onBackToNow,
    notes,
    onPin,
  }: {
    /** This run's timeline, as the Cosmos strip draws it. */
    timeline: { points: readonly TimelinePoint[]; breaks: readonly number[] };
    /** `now` is the live tick, `at` the rewound tick or null for now. */
    rewind: { now: number; at: number | null; ticksPerDay: number; disabled: boolean };
    onRewind: (tick: number) => void;
    onBackToNow: () => void;
    /** The notes pinned on this run, in tick order; each one's button rewinds to its tick. */
    notes: readonly { tick: number; text: string }[];
    /** Pins a note on a tick of the strip; null where notes cannot be pinned (the Cosmos panel). */
    onPin: ((tick: number, text: string) => void) | null;
  } = $props();

  const first = $derived(timeline.points[0]?.tick ?? 0);
  const value = $derived(rewind.at ?? rewind.now);
  const dayOf = (t: number): number => Math.floor((t - first) / rewind.ticksPerDay) + 1;
  const dayText = $derived(`Day ${String(dayOf(value))}${rewind.at === null ? ', now' : ''}`);
  /** "Day 3: 12 creatures, mean warmth 0.41", from the last point at or before the strip's tick. */
  const valueText = $derived.by(() => {
    const p = timeline.points.findLast((q) => q.tick <= value) ?? timeline.points[0];
    const about = p ? `: ${String(p.population)} creatures, mean warmth ${p.trust.toFixed(2)}` : '';
    return `Day ${String(dayOf(value))}${about}`;
  });

  /** The tick the open note field pins to, or null while it is closed. */
  let pinAt: number | null = $state(null);
  let text = $state('');
  let pinButton: HTMLButtonElement | undefined = $state();
  let field: HTMLInputElement | undefined = $state();

  async function openField(): Promise<void> {
    pinAt = value;
    text = '';
    await tick();
    field?.focus();
  }
  async function closeField(): Promise<void> {
    pinAt = null;
    await tick();
    pinButton?.focus();
  }
  function pin(e: SubmitEvent): void {
    e.preventDefault();
    if (pinAt !== null && text.trim() !== '') onPin?.(pinAt, text);
    void closeField();
  }
  function onFieldKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    void closeField();
  }
</script>

<!-- The rewind range (spec 8), with a mark at each friendship that ended, and the pinned notes. -->
<div class="rewind">
  <label for="rewind">Rewind</label>
  <input
    id="rewind"
    type="range"
    min={first}
    max={rewind.now}
    step="1"
    {value}
    list="rewind-breaks"
    aria-valuetext={valueText}
    disabled={rewind.disabled}
    oninput={(e) => {
      onRewind(Number(e.currentTarget.value));
    }}
  />
  <span aria-hidden="true">{dayText}</span>
  <!-- A friendship ended at each mark. -->
  <datalist id="rewind-breaks">
    {#each timeline.breaks as b, i (i)}
      <option value={b}></option>
    {/each}
  </datalist>
  <button type="button" disabled={rewind.at === null} onclick={onBackToNow}>Back to now</button>
</div>
{#if notes.length > 0}
  <ul class="notes" aria-label="Notes">
    {#each notes as note, i (i)}
      <li>
        <button
          type="button"
          disabled={rewind.disabled}
          onclick={() => {
            onRewind(note.tick);
          }}>Note on day {dayOf(note.tick)}: {note.text}</button
        >
      </li>
    {/each}
  </ul>
{/if}
{#if onPin}
  {#if pinAt === null}
    <button type="button" disabled={rewind.disabled} bind:this={pinButton} onclick={() => void openField()}
      >Pin a note</button
    >
  {:else}
    <form class="pin" onsubmit={pin}>
      <label for="note">Note (at most 80 characters)</label>
      <input
        id="note"
        type="text"
        autocomplete="off"
        aria-describedby="note-hint"
        bind:value={text}
        bind:this={field}
        onkeydown={onFieldKey}
      />
      <p id="note-hint">The note is for day {dayOf(pinAt)}. It stays on this device.</p>
      <div class="row">
        <button type="submit">Pin</button>
        <button type="button" onclick={() => void closeField()}>Cancel</button>
      </div>
    </form>
  {/if}
{/if}

<style>
  .rewind {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  input[type='range'] {
    flex: 1 1 8rem;
    accent-color: var(--accent);
  }
  .notes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0.5rem 0;
    padding: 0;
    list-style: none;
  }
  .notes button {
    text-align: start;
  }
  .pin {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  .pin input {
    font: inherit;
    min-height: 1.75rem;
  }
  .pin p {
    margin: 0;
    color: var(--muted);
  }
  .row {
    display: flex;
    gap: 0.5rem;
  }
</style>
