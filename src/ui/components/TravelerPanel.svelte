<script lang="ts">
  // Travelers by code (ADR 0015 item 9), in the Population panel: the picked creature's diary and
  // its traveler code, the code box that welcomes one, and the travelers this valley welcomed.
  let {
    picked,
    diary,
    travelers,
    max,
    off,
    makeCode,
    welcome,
    remove,
  }: {
    /** The picked creature's id and name, or null. */
    picked: { id: string; name: string } | null;
    /** The picked creature's diary lines, oldest first. */
    diary: readonly string[];
    /** The welcomed travelers' names, in welcome order. */
    travelers: readonly string[];
    max: number;
    /** Why welcoming and removing are off (a start waits, a challenge runs), or null. */
    off: string | null;
    /** The picked creature's code, or null for a creature with no home valley. */
    makeCode: (id: string) => Promise<string | null>;
    /** Welcomes the code's traveler; false for a code that does not open. */
    welcome: (code: string) => Promise<boolean>;
    remove: (i: number) => void;
  } = $props();

  /** The last code made, for the creature it was made for. */
  let made: { id: string; code: string } | null = $state(null);
  let pasted = $state('');
  /** What the last action did, in a status region. */
  let said = $state('');
  const full = $derived(travelers.length >= max);

  async function make(id: string, name: string): Promise<void> {
    const code = await makeCode(id);
    if (code === null) {
      made = null;
      said = `${name} has no home valley yet, so ${name} cannot travel.`;
      return;
    }
    made = { id, code };
    try {
      await navigator.clipboard.writeText(code);
      said = `${name}'s traveler code is copied.`;
    } catch {
      said = `${name}'s traveler code is ready. Select it and copy it.`;
    }
  }

  async function take(): Promise<void> {
    const ok = await welcome(pasted);
    said = ok ? 'The traveler comes in at the gate. The valley starts again.' : 'That code does not open.';
    if (ok) pasted = '';
  }
</script>

<section class="travelers" aria-labelledby="travelers-title">
  <h3 id="travelers-title">Travelers</h3>
  {#if picked}
    {@const { id, name } = picked}
    <h4>{name}'s diary</h4>
    {#if diary.length > 0}
      <ol class="diary">
        {#each diary as line, i (i)}
          <li>{line}</li>
        {/each}
      </ol>
    {:else}
      <p class="line">Nothing yet.</p>
    {/if}
    <button
      type="button"
      onclick={() => {
        void make(id, name);
      }}>Make {name}'s traveler code</button
    >
    {#if made?.id === id}
      <label for="traveler-code">{name}'s traveler code</label>
      <input
        id="traveler-code"
        type="text"
        readonly
        value={made.code}
        onfocus={(e) => {
          e.currentTarget.select();
        }}
      />
    {/if}
  {:else}
    <p class="line">Pick a creature to read its diary and make its traveler code.</p>
  {/if}
  <label for="traveler-paste">Welcome a traveler</label>
  <div class="row">
    <input
      id="traveler-paste"
      type="text"
      placeholder="t1.…"
      autocomplete="off"
      spellcheck="false"
      bind:value={pasted}
      disabled={off !== null || full}
      aria-describedby={off !== null || full ? 'traveler-why' : undefined}
    />
    <button
      type="button"
      disabled={off !== null || full || pasted.trim() === ''}
      onclick={() => {
        void take();
      }}>Welcome</button
    >
  </div>
  {#if off !== null || full}
    <p class="line" id="traveler-why">{off ?? `A valley welcomes at most ${String(max)} travelers.`}</p>
  {/if}
  {#if travelers.length > 0}
    <ul class="welcomed">
      {#each travelers as name, i (i)}
        <li>
          {name}
          <button
            type="button"
            aria-label="Send {name} home"
            disabled={off !== null}
            onclick={() => {
              remove(i);
            }}>Send home</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  <p role="status" class="line">{said}</p>
</section>

<style>
  .travelers {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-top: 1px solid var(--fg);
    padding-top: 0.5rem;
  }
  h3,
  h4 {
    margin: 0;
    font-size: 1em;
  }
  .line {
    margin: 0;
  }
  .diary {
    margin: 0;
    padding-left: 1.4rem;
    max-height: 9rem;
    overflow-y: auto;
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  .row input {
    flex: 1;
    min-width: 0;
  }
  input,
  button {
    min-height: 1.75rem;
  }
  .welcomed {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .welcomed li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
  }
</style>
