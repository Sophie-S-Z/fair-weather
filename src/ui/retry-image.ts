// A Svelte action for an image that can fail after the page loads (ADR 0014 item 11): each failure
// waits, then sets the source again with `?retry=n`; after the last wait comes the fallback image,
// and after that nothing but the alt text.

export interface RetryOptions {
  /** The waits before each new try, in milliseconds (ASSET_WAITS_MS). */
  waits: readonly number[];
  /** The image to show when every try failed, or null for the alt text. */
  fallback: string | null;
}

/** `src` with `retry=n`; a data or blob URL has no request to repeat, so it is set again as it is. */
export function retrySrc(src: string, n: number): string {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  return `${src}${src.includes('?') ? '&' : '?'}retry=${String(n)}`;
}

export function retryImage(node: HTMLImageElement, opts: RetryOptions): { destroy(): void } {
  const first = node.getAttribute('src') ?? '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopListening = (): void => undefined;
  let tries = 0;

  /** Sets `src` (the first try is the one already loading) and resolves when the image loads or fails. */
  const attempt = (src: string): Promise<true | null> =>
    new Promise((resolve) => {
      const done = (loaded: boolean): void => {
        stopListening();
        resolve(loaded ? true : null);
      };
      const onLoad = (): void => done(true);
      const onError = (): void => done(false);
      stopListening = () => {
        node.removeEventListener('load', onLoad);
        node.removeEventListener('error', onError);
      };
      node.addEventListener('load', onLoad);
      node.addEventListener('error', onError);
      if (tries++ > 0) node.setAttribute('src', src);
    });
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    });

  void tryThenFallback(attempt, first, opts.waits, opts.fallback, wait);
  return {
    destroy() {
      clearTimeout(timer);
      stopListening();
    },
  };
}

/**
 * The one rule for an image (ADR 0014 item 11), for the export: `attempt` tries `src`, and again
 * after each of `waits` with `?retry=n`; then the fallback gets one try, unless it is `src`. Null
 * when all failed.
 */
export async function tryThenFallback<T>(
  attempt: (src: string) => Promise<T | null>,
  src: string,
  waits: readonly number[],
  fallback: string | null,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T | null> {
  for (let n = 0; n <= waits.length; n++) {
    const ms = n > 0 ? waits[n - 1] : undefined;
    if (ms !== undefined) await wait(ms);
    const got = await attempt(n === 0 ? src : retrySrc(src, n));
    if (got !== null) return got;
  }
  return fallback === null || fallback === src ? null : attempt(fallback);
}

/** An image that loads and decodes, or null. */
async function decoded(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Loads an image off the page, as the PNG export does, by `tryThenFallback`. */
export function loadImageWithRetry(
  src: string,
  waits: readonly number[],
  fallback: string | null,
): Promise<HTMLImageElement | null> {
  return tryThenFallback(decoded, src, waits, fallback);
}
