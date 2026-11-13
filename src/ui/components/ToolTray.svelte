<script lang="ts">
  import type { BidReply, Structure } from '../../sim/types.ts';
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
  }: {
    tools: readonly WorldVerb[];
    /** What the place tool sets, which names its button. */
    placeKind: Structure['kind'];
    /** Tools used up in this chapter; their buttons say so. */
    used?: readonly Verb[];
    active: Verb | null;
    /** The reply Enter sends with the respond tool. */
    reply: BidReply;
    /** The tool the ghost hand taps, or null. */
    ghost: Verb | null;
    onPick: (v: Verb) => void;
    onReply: (r: BidReply) => void;
  } = $props();

  const LABELS: Record<Exclude<WorldVerb, 'place'>, string> = {
    wake: 'Wake',
    respond: 'Respond',
    shine: 'Sunlight',
    whisper: 'Whisper',
    thread: 'Thread',
    fog: 'Fog',
    blow: 'Wind',
  };
  const PLACE_LABELS: Record<Structure['kind'], string> = {
    bench: 'Bench',
    bridge: 'Bridge',
    lantern: 'Lantern',
  };
  const REPLIES: { reply: BidReply; key: string; label: string }[] = [
    { reply: 'toward', key: 'G', label: 'Glow back' },
    { reply: 'away', key: 'H', label: 'Hold still' },
    { reply: 'against', key: 'R', label: 'Rumble' },
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
