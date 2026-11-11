<script lang="ts">
  import type { BidReply } from '../../sim/types.ts';
  import type { Verb } from '../../story/verbs.ts';

  let {
    tools,
    active,
    onPick,
    onReply,
  }: {
    tools: readonly Verb[];
    active: Verb | null;
    onPick: (v: Verb) => void;
    onReply: (r: BidReply) => void;
  } = $props();

  const LABELS: Record<Verb, string> = { wake: 'Wake', respond: 'Respond', bet: 'Bet', place: 'Bench' };
  const REPLIES: { reply: BidReply; key: string; label: string }[] = [
    { reply: 'toward', key: 'G', label: 'Glow back' },
    { reply: 'away', key: 'H', label: 'Hold still' },
    { reply: 'against', key: 'R', label: 'Rumble' },
  ];
</script>

<div class="tray">
  <div role="group" aria-label="Tools">
    {#each tools as tool, i (tool)}
      <button
        type="button"
        aria-pressed={tool === active}
        onclick={() => {
          onPick(tool);
        }}
      >
        <kbd>{i + 1}</kbd>
        {LABELS[tool]}
      </button>
    {/each}
  </div>
  {#if active === 'respond'}
    <div role="group" aria-label="Reply to the sky">
      {#each REPLIES as r (r.reply)}
        <button
          type="button"
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
</style>
