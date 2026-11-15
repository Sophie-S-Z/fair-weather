/// <reference types="svelte" />

declare module '*.ink' {
  /** The compiled Ink story JSON, as createInk expects. */
  const story: string;
  export default story;
}

interface ImportMetaEnv {
  /** Where the opt-in counts go (ADR 0014 item 9). Unset in every production build: the switch stays hidden. */
  readonly VITE_ANALYTICS_URL?: string;
}
