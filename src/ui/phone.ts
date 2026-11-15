// The two media queries of the phone layout (ADR 0014 item 15).
/** Below 600 CSS pixels wide, the panels and dialogs are full-screen sheets. */
export const PHONE = '(max-width: 599.98px)';
/** The viewport is taller than wide: the scene ends above the bottom bar. */
export const PORTRAIT = '(orientation: portrait)';

/** Calls `set` with whether `query` matches now and on each change; returns the function that stops it. */
export function watchMedia(query: string, set: (matches: boolean) => void): () => void {
  const list = window.matchMedia(query);
  const onChange = (): void => {
    set(list.matches);
  };
  onChange();
  list.addEventListener('change', onChange);
  return () => {
    list.removeEventListener('change', onChange);
  };
}
