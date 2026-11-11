/// <reference types="svelte" />

declare module '*.ink' {
  /** The compiled Ink story JSON, as createInk expects. */
  const story: string;
  export default story;
}
