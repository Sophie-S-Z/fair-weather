<script lang="ts">
  import type { BidReply, GiftMove, Structure } from '../../sim/types.ts';
  import type { Verb, WorldVerb } from '../../story/verbs.ts';

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
  } = $props();

  const LABELS: Record<Exclude<WorldVerb, 'place'>, string> = {
    wake: 'Wake',
    respond: 'Respond',
    shine: 'Sunlight',
    whisper: 'Whisper',
    thread: 'Thread',
    fog: 'Fog',
    blow: 'Wind',
    walk: 'Walk',
    manner: 'Manner',
    join: 'Join',
    pose: 'Pose',
    keepsake: 'Keepsake',
  };
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
          {tool === 'place' ? PLACE_LABELS[placeKind] : LABELS[tool]}{used.includes(tool)
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
