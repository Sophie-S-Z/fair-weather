<script lang="ts">
  import type { HeroKind } from '../../sim/types.ts';
  import { characters, HEROES, heroResult, NAME_LENGTH, parseHero } from '../../story/journey.ts';

  let { finish }: { finish: (result: string) => void } = $props();

  /** The bridge (ADR 0013 item 11): the first hero until the player picks another. */
  let kind: HeroKind = $state(HEROES[0]?.id ?? 'lantern');
  /** The typed name; it stays on the device (spec 15.4), so it is never logged or sent. */
  let name = $state('');
  const result = $derived(heroResult(kind, name));
  const wakeAs = $derived(parseHero(result).name);
  /** The rain lines: [left %, delay s]. */
  const RAIN = [
    [6, 0],
    [19, 0.9],
    [31, 0.4],
    [44, 1.3],
    [57, 0.2],
    [69, 1.1],
    [82, 0.6],
    [94, 1.5],
  ];

  /** Cuts the field at NAME_LENGTH characters as heroResult counts them, so the button names what is kept. */
  function onName(e: Event & { currentTarget: HTMLInputElement }): void {
    const field = e.currentTarget;
    const cut = characters(field.value).slice(0, NAME_LENGTH).join('');
    if (cut !== field.value) field.value = cut;
    name = cut;
  }
</script>

<section aria-labelledby="hero-legend">
  <div class="rain" aria-hidden="true">
    {#each RAIN as [left, delay] (left)}
      <span style:left="{left}%" style:animation-delay="{delay}s"></span>
    {/each}
  </div>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      finish(result);
    }}
  >
    <fieldset>
      <legend id="hero-legend">Choose your hero</legend>
      <div class="heroes">
        {#each HEROES as hero (hero.id)}
          <div class="hero">
            <input
              type="radio"
              name="hero"
              id="hero-{hero.id}"
              value={hero.id}
              bind:group={kind}
              aria-describedby="hero-{hero.id}-about"
            />
            <label for="hero-{hero.id}">{hero.name}</label>
            <p id="hero-{hero.id}-about">{hero.look}. {hero.knack}</p>
          </div>
        {/each}
      </div>
    </fieldset>
    <label class="name">
      Name your hero
      <input
        type="text"
        value={name}
        oninput={onName}
        autocomplete="off"
        spellcheck="false"
        aria-describedby="hero-name-help"
      />
    </label>
    <p id="hero-name-help" class="help">
      At most {NAME_LENGTH} characters. The name stays on this device.
    </p>
    <button type="submit">Wake as {wakeAs}</button>
  </form>
</section>

<style>
  section {
    max-height: 70vh;
    overflow-y: auto;
  }
  /* A quiet rain: thin lines that fall and fade. Reduced motion holds them still. */
  .rain {
    position: relative;
    height: 2.5rem;
    overflow: hidden;
  }
  .rain span {
    position: absolute;
    top: -1rem;
    width: 1px;
    height: 1rem;
    background: var(--muted);
    opacity: 0.5;
    animation: fall 1.8s linear infinite;
  }
  :global(:root[data-motion='reduced']) .rain span {
    animation: none;
    top: 0.75rem;
  }
  @keyframes fall {
    to {
      transform: translateY(3.5rem);
      opacity: 0;
    }
  }
  fieldset {
    margin: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--muted);
    border-radius: 0.4rem;
  }
  legend {
    font-weight: bold;
  }
  .heroes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.25rem 0.75rem;
  }
  .hero {
    display: grid;
    grid-template-columns: auto 1fr;
    align-content: start;
    align-items: baseline;
    column-gap: 0.4rem;
  }
  .hero label {
    font-weight: bold;
  }
  .hero p {
    grid-column: 2;
    margin: 0;
    font-size: 0.9em;
  }
  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .help {
    font-size: 0.9em;
    color: var(--muted);
  }
</style>
