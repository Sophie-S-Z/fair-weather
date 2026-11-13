<script lang="ts">
  import type { TimelinePoint } from '../../render/timeline.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';

  let {
    lite,
    ties,
    timeline,
    label,
    rewind,
    onRewind,
    onBackToNow,
  }: {
    /** The world drawn now: the live one, or the rewound one. */
    lite: WorldLite;
    ties: ReadonlyMap<string, { friends: readonly string[]; scars: readonly string[] }>;
    /** This run's timeline, as the Cosmos strip draws it. */
    timeline: { points: readonly TimelinePoint[]; breaks: readonly number[] };
    label: (id: string) => string;
    /**
     * The rewind range, or null while rewind is locked: `now` is the live tick, `at` the rewound
     * tick or null for now.
     */
    rewind: { now: number; at: number | null; ticksPerDay: number; disabled: boolean } | null;
    onRewind: (tick: number) => void;
    onBackToNow: () => void;
  } = $props();

  const here = $derived(lite.creatures.filter((c) => c.state !== 'away'));
  const away = $derived(new Set(lite.creatures.filter((c) => c.state === 'away').map((c) => c.id)));
  const rumor = $derived(lite.rumor);

  /** "28" for a flat series, else "28 now, from 26 to 30". */
  function series(values: readonly number[], show: (n: number) => string): string {
    const now = show(values.at(-1) ?? 0);
    const lo = show(Math.min(...values));
    const hi = show(Math.max(...values));
    return lo === hi ? now : `${now} now, from ${lo} to ${hi}`;
  }
  const summary = $derived.by(() => {
    const { points, breaks } = timeline;
    if (points.length === 0) return '';
    const population = series(
      points.map((p) => p.population),
      (n) => String(n),
    );
    const trust = series(
      points.map((p) => p.trust),
      (n) => n.toFixed(2),
    );
    const ended = breaks.length === 1 ? '1 friendship ended' : `${String(breaks.length)} friendships ended`;
    return `This chapter: population ${population}; trust ${trust}; ${ended}.`;
  });

  /**
   * "Pim: 3 friends (1 away), 1 scar": away ones count, marked, as in the drawer. While a rumor goes
   * round, the reflection counts the friends here, the only ones who can hold it.
   */
  function line(id: string): string {
    const mine = ties.get(id);
    const friends = mine?.friends ?? [];
    const scars = mine?.scars ?? [];
    let text = `${label(id)}: ${count(friends, 'friend')}, ${count(scars, 'scar')}`;
    const near = friends.filter((f) => !away.has(f));
    if (rumor && rumor.about !== id && near.length > 0) {
      const k = near.filter((f) => rumor.holders.includes(f)).length;
      text += `, imagines ${String(k)} of ${String(near.length)} friends believe it`;
    }
    return text;
  }
  function count(ids: readonly string[], one: string): string {
    const gone = ids.filter((i) => away.has(i)).length;
    return `${String(ids.length)} ${one}${ids.length === 1 ? '' : 's'}${gone > 0 ? ` (${String(gone)} away)` : ''}`;
  }

  const first = $derived(timeline.points[0]?.tick ?? 0);
  const value = $derived(rewind ? (rewind.at ?? rewind.now) : 0);
  const dayText = $derived(
    rewind
      ? `Day ${String(Math.floor((value - first) / rewind.ticksPerDay) + 1)}${rewind.at === null ? ', now' : ''}`
      : '',
  );
</script>

<!-- What the Cosmos canvas shows, as text (spec 11.3), and the rewind range (spec 8). -->
<!-- A section the player can fold, so the network under it shows. -->
<section class="panel" aria-labelledby="cosmos-title">
  <details open>
    <summary id="cosmos-title">Who is friends with whom</summary>
    {#if summary}<p>{summary}</p>{/if}
    {#if rumor}
      <p>The rumor: {rumor.sign > 0 ? 'a kind' : 'an unkind'} word about {label(rumor.about)}.</p>
    {/if}
    <!-- The list scrolls in a small box, so the keyboard can reach it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <ul class="list" tabindex="0" aria-label="Creatures here">
      {#each here as c (c.id)}
        <li>{line(c.id)}</li>
      {/each}
    </ul>
    {#if rewind}
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
          aria-valuetext={dayText}
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
    {/if}
  </details>
</section>

<style>
  .panel {
    width: min(18rem, calc(100vw - 2rem));
    padding: 0.5rem 0.75rem;
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  summary {
    margin: 0 0 0.25rem;
    font-weight: bold;
    cursor: pointer;
  }
  p {
    margin: 0 0 0.5rem;
  }
  .list {
    max-height: 30vh;
    overflow-y: auto;
    margin: 0 0 0.5rem;
    padding-left: 1.25rem;
  }
  .rewind {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  input {
    flex: 1 1 8rem;
    accent-color: var(--accent);
  }
</style>
