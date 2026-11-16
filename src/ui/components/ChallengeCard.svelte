<script lang="ts">
  import type { Season } from '../../sim/types.ts';
  import { CHALLENGE_IDS, CHALLENGES, outcome } from '../../story/challenges.ts';
  import type { ChallengeId, ChallengeState } from '../../story/challenges.ts';

  let {
    challenge,
    state,
    season,
    canDance,
    locked,
    onPick,
    onDance,
    onTryAgain,
    onStop,
  }: {
    /** The challenge of the run now, or null for none. */
    challenge: ChallengeId | null;
    state: ChallengeState | null;
    /** The season of the newest snapshot. */
    season: Season;
    /** Whether Bell's "Start the dance" can send now: once per run, and not while rewound. */
    canDance: boolean;
    /** Each choice here starts a run, so they are off while a start waits and after the worker failed. */
    locked: boolean;
    onPick: (id: ChallengeId) => void;
    onDance: () => void;
    onTryAgain: () => void;
    onStop: () => void;
  } = $props();

  /** The pass or fail line, or the season while the challenge is open. */
  const line = $derived(outcome(challenge, state) ?? `The challenge is not finished. Season: ${season}.`);
  /** Open at first on a wide screen; on a narrow one it starts folded, so the panels under it show. */
  const wide = window.matchMedia('(min-width: 48rem)').matches;
</script>

<!-- The challenges (spec 13.1): nothing is scored or kept. A card the player can fold. -->
<section class="card" aria-labelledby="challenges-title">
  <details open={wide}>
    <summary id="challenges-title">Challenges</summary>
    <div class="body">
      {#if challenge === null}
        {#each CHALLENGE_IDS as id (id)}
          <button
            type="button"
            disabled={locked}
            onclick={() => {
              onPick(id);
            }}>{CHALLENGES[id].text}</button
          >
        {/each}
      {:else}
        <p>{CHALLENGES[challenge].text}</p>
        {#if challenge === 'bell'}
          <button type="button" disabled={!canDance} onclick={onDance}>Start the dance</button>
        {/if}
        <p>{line}</p>
        <div class="row">
          <button type="button" disabled={locked} onclick={onTryAgain}>Try again</button>
          <button type="button" disabled={locked} onclick={onStop}>Stop the challenge</button>
        </div>
      {/if}
    </div>
  </details>
</section>

<style>
  .card {
    background: var(--bg);
    border: 2px solid var(--fg);
    border-radius: 0.6rem;
  }
  summary {
    padding: 0.5rem 0.75rem;
    min-height: 1.75rem;
    font-weight: bold;
    cursor: pointer;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 0.75rem 0.75rem;
  }
  p {
    margin: 0;
  }
  button {
    text-align: start;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
