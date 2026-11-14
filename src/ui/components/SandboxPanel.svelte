<script lang="ts">
  import type { Snippet } from 'svelte';
  import { knobValue } from '../../story/sandbox.ts';
  import type { Knob, KnobId, SandboxTool } from '../../story/sandbox.ts';

  let {
    title,
    knobs,
    onKnob,
    tools,
    tool,
    onTool,
    children,
  }: {
    title: string;
    /** The panel's knobs: each one's step index now, its last index, and why it is off, or null. */
    knobs: readonly { knob: Knob; index: number; max: number; why: string | null }[];
    /** A knob moved to `index`; `input` is its range, which a start that fails puts back. */
    onKnob: (id: KnobId, index: number, input: HTMLInputElement) => void;
    /**
     * The panel's tools with their keys (1 to 8). Each panel's are a radio group of their own, all
     * set from `tool`, so an open panel's radios are in the Tab order when the tool is another panel's.
     */
    tools: readonly { tool: SandboxTool; key: number; label: string }[];
    tool: SandboxTool;
    onTool: (t: SandboxTool) => void;
    /** The panel's other controls, under its knobs. */
    children?: Snippet;
  } = $props();
</script>

<!-- A sandbox panel (spec 12.3): closed at first, so the scene shows. -->
<details class="panel">
  <summary>{title}</summary>
  <div class="body">
    {#each knobs as { knob, index, max, why } (knob.id)}
      <div class="knob">
        <label for="knob-{knob.id}">{knob.label}</label>
        <input
          type="range"
          id="knob-{knob.id}"
          min="0"
          {max}
          step="1"
          value={index}
          aria-valuetext={String(knobValue(knob, index))}
          disabled={why !== null}
          aria-describedby={why === null ? undefined : `why-${knob.id}`}
          onchange={(e) => {
            onKnob(knob.id, Number(e.currentTarget.value), e.currentTarget);
          }}
        />
        <span class="value" aria-hidden="true">{knobValue(knob, index)}</span>
        {#if why !== null}
          <p class="why" id="why-{knob.id}">{why}</p>
        {/if}
      </div>
    {/each}
    {@render children?.()}
    {#if tools.length > 0}
      <fieldset class="choices">
        <legend>Tools</legend>
        {#each tools as t (t.tool)}
          <label class="tool">
            <input
              type="radio"
              name="sandbox-tool-{title.toLowerCase()}"
              value={t.tool}
              checked={t.tool === tool}
              onchange={() => {
                onTool(t.tool);
              }}
            />
            <kbd>{t.key}</kbd>
            {t.label}
          </label>
        {/each}
      </fieldset>
    {/if}
  </div>
</details>

<style>
  .panel {
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
  .knob {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 0.5rem;
  }
  .knob label {
    grid-column: 1 / -1;
  }
  input[type='range'] {
    accent-color: var(--accent);
    min-height: 1.5rem;
  }
  .why {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--muted);
  }
  .tool {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 1.75rem;
  }
  kbd {
    font: inherit;
    font-size: 0.8em;
    border: 1px solid currentColor;
    border-radius: 0.2rem;
    padding: 0 0.3em;
  }
</style>
