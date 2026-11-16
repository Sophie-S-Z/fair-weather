<script lang="ts">
  import type { BidReply, GiftMove, Structure, VotingRule } from '../../sim/types.ts';
  import type { WorldLite } from '../../sim-host/protocol.ts';
  import type { Verb, VerbInput, WorldVerb } from '../../story/verbs.ts';
  import { RULE_LABELS, SONG_LABELS, spotLabel, TOOL_LABELS } from '../tool-labels.ts';

  let {
    tools,
    placeKind,
    used = [],
    active,
    reply,
    ghost,
    onPick,
    onReply,
    manner,
    onManner,
    canPlant,
    plantCost,
    plantReady,
    onPlant,
    keepsakes,
    giveTo,
    onGive,
    pack = null,
    picked = null,
    onAct = () => undefined,
  }: {
    tools: readonly WorldVerb[];
    /** What the place tool sets, which names its button. */
    placeKind: Exclude<Structure['kind'], 'path'>;
    /** Tools used up in this chapter; their buttons say so. */
    used?: readonly Verb[];
    active: Verb | null;
    /** The reply Enter sends with the respond tool. */
    reply: BidReply;
    /** The tool the ghost hand taps, or null. */
    ghost: Verb | null;
    onPick: (v: Verb) => void;
    onReply: (r: BidReply) => void;
    /** The hero's standing manner, which the manner tool shows and sets. */
    manner: { reply: BidReply; gift: GiftMove };
    onManner: (m: { reply: BidReply; gift: GiftMove }) => void;
    /** A Seedcarrier hero can plant a gift. */
    canPlant: boolean;
    /** The berries a gift costs, and whether the hero has them. */
    plantCost: number;
    plantReady: boolean;
    onPlant: () => void;
    /** The keepsakes the hero holds, with their labels ("starling feather"). */
    keepsakes: readonly { id: string; label: string }[];
    /** The picked creature's name, whom a keepsake goes to, or null with no pick. */
    giveTo: string | null;
    onGive: (id: string) => void;
    /** The valley's pack in the last snapshot: Step down's state, the council, the pond. */
    pack?: WorldLite['pack'];
    /** The picked creature, not the hero, with its name; a song goes to it or comes from it. */
    picked?: { id: string; name: string } | null;
    /** Sends a Stage 2 verb: Step down, a vote or a proposal, and Learn or Sing. */
    onAct?: (v: VerbInput) => void;
  } = $props();

  const PROPOSALS: { rule: Exclude<VotingRule, 'plurality'>; label: string }[] = [
    { rule: 'approval', label: 'Approval' },
    { rule: 'runoff', label: 'Instant runoff' },
    { rule: 'score', label: 'Score' },
  ];
  const council = $derived(pack?.id === 'council' ? pack : null);
  const pond = $derived(pack?.id === 'shallows' ? pack : null);
  const singWhy = $derived(
    !pond
      ? ''
      : pond.heroSong === null
        ? 'Learn a song from a frog first.'
        : pond.sangToday
          ? 'You sang today. Sing again tomorrow.'
          : picked === null
            ? 'Pick a frog to sing to.'
            : '',
  );

  const PLACE_LABELS: Record<Exclude<Structure['kind'], 'path'>, string> = {
    bench: 'Bench',
    bridge: 'Bridge',
    lantern: 'Lantern',
  };
  const REPLIES: { reply: BidReply; key: string; label: string }[] = [
    { reply: 'toward', key: 'G', label: 'Glow back' },
    { reply: 'away', key: 'H', label: 'Hold still' },
    { reply: 'against', key: 'R', label: 'Rumble' },
  ];
  const MANNER_REPLIES: { reply: BidReply; key: string; label: string }[] = [
    { reply: 'toward', key: 'G', label: 'Wave back' },
    { reply: 'away', key: 'H', label: 'Stay still' },
    { reply: 'against', key: 'R', label: 'Snap' },
  ];
  const GIFTS: { gift: GiftMove; key: string; label: string }[] = [
    { gift: 'give', key: 'O', label: 'Give' },
    { gift: 'keep', key: 'K', label: 'Keep' },
  ];
</script>

<div class="tray">
  <div role="group" aria-label="Tools">
    {#each tools as tool, i (tool)}
      <span class="slot">
        {#if tool === ghost}<span class="ghost" aria-hidden="true"></span>{/if}
        <button
          type="button"
          aria-pressed={tool === active}
          onclick={() => {
            onPick(tool);
          }}
        >
          <kbd>{i + 1}</kbd>
          {tool === 'place' ? PLACE_LABELS[placeKind] : TOOL_LABELS[tool]}{used.includes(tool)
            ? ' ([PLACEHOLDER] used)'
            : ''}
        </button>
      </span>
    {/each}
  </div>
  {#if active === 'respond'}
    <div role="group" aria-label="Reply to the sky">
      {#each REPLIES as r (r.reply)}
        <button
          type="button"
          aria-pressed={r.reply === reply}
          onclick={() => {
            onReply(r.reply);
          }}><kbd>{r.key}</kbd> {r.label}</button
        >
      {/each}
    </div>
  {:else if active === 'manner'}
    <div role="group" aria-label="How your hero answers">
      {#each MANNER_REPLIES as r (r.reply)}
        <button
          type="button"
          aria-pressed={r.reply === manner.reply}
          onclick={() => {
            onManner({ reply: r.reply, gift: manner.gift });
          }}><kbd>{r.key}</kbd> {r.label}</button
        >
      {/each}
    </div>
    <div role="group" aria-label="Give or keep">
      {#each GIFTS as g (g.gift)}
        <button
          type="button"
          aria-pressed={g.gift === manner.gift}
          onclick={() => {
            onManner({ reply: manner.reply, gift: g.gift });
          }}><kbd>{g.key}</kbd> {g.label}</button
        >
      {/each}
      {#if canPlant}
        <button type="button" disabled={!plantReady} aria-describedby="plant-why" onclick={onPlant}
          ><kbd>L</kbd> Plant a gift</button
        >
        <span id="plant-why" class="why"
          >{plantReady
            ? ''
            : `Planting a gift needs ${String(plantCost)} ${plantCost === 1 ? 'berry' : 'berries'}.`}</span
        >
      {/if}
    </div>
  {:else if active === 'stepDown' && pack?.id === 'foglight'}
    <div role="group" aria-label="Step down">
      <button
        type="button"
        aria-pressed={pack.stepDown}
        onclick={() => {
          onAct({ verb: 'stepDown', on: !pack.stepDown });
        }}><kbd>Enter</kbd> {pack.stepDown ? 'Stepping down into the fog' : 'Staying on high ground'}</button
      >
    </div>
  {:else if active === 'vote' && council}
    <div role="group" aria-label="Vote for a stake">
      {#each council.spots as s (s.id)}
        <button
          type="button"
          aria-pressed={s.id === council.heroVote}
          onclick={() => {
            onAct({ verb: 'vote', spot: s.id });
          }}>{spotLabel(s.id)}</button
        >
      {/each}
    </div>
    <div role="group" aria-label="Propose a new count">
      {#each PROPOSALS as p (p.rule)}
        <button
          type="button"
          aria-pressed={p.rule === council.rule}
          disabled={council.rule !== 'plurality'}
          onclick={() => {
            onAct({ verb: 'propose', rule: p.rule });
          }}>{p.label}</button
        >
      {/each}
      <span class="why">The council counts by {RULE_LABELS[council.rule]}.</span>
    </div>
  {:else if active === 'sing' && pond}
    <div role="group" aria-label="Songs">
      <button
        type="button"
        disabled={picked === null}
        onclick={() => {
          if (picked) onAct({ verb: 'learn', from: picked.id });
        }}><kbd>L</kbd> Learn {picked ? `${picked.name}'s song` : 'a song'}</button
      >
      <button
        type="button"
        disabled={singWhy !== ''}
        aria-describedby="sing-why"
        onclick={() => {
          if (picked) onAct({ verb: 'sing', to: picked.id });
        }}
        ><kbd>Enter</kbd> Sing {pond.heroSong ? SONG_LABELS[pond.heroSong] : 'a song'}{picked
          ? ` to ${picked.name}`
          : ''}</button
      >
      <span id="sing-why" class="why">{singWhy}</span>
    </div>
  {:else if active === 'keepsake' && keepsakes.length > 0}
    <div role="group" aria-label="Keepsakes">
      {#each keepsakes as k (k.id)}
        <button
          type="button"
          disabled={giveTo === null}
          onclick={() => {
            onGive(k.id);
          }}>Give the {k.label} to {giveTo ?? 'the creature you pick'}</button
        >
      {/each}
    </div>
  {/if}
</div>

<style>
  .tray {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  div[role='group'] {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--bg);
  }
  kbd {
    font: inherit;
    font-size: 0.8em;
    border: 1px solid currentColor;
    border-radius: 0.2rem;
    padding: 0 0.3em;
    margin-right: 0.25em;
  }
  .slot {
    position: relative;
  }
  .why {
    align-self: center;
    background: var(--bg);
  }
  .why:empty {
    display: none;
  }
  /* The ghost hand: a faint fingertip that taps the new verb's tool, once per verb (spec 12.6). */
  .ghost {
    position: absolute;
    left: 50%;
    top: -1.75rem;
    width: 1.25rem;
    height: 1.25rem;
    margin-left: -0.625rem;
    border: 3px solid var(--muted);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    opacity: 0.6;
    pointer-events: none;
    animation: tap 1.2s ease-in-out 3;
  }
  :global(:root[data-motion='reduced']) .ghost {
    animation: none;
  }
  @keyframes tap {
    50% {
      transform: rotate(-45deg) translate(-0.5rem, 0.5rem);
    }
  }
</style>
