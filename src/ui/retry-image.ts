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
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let usedFallback = false;

  function onError(): void {
    if (usedFallback) return; // the fallback failed too: the alt text stays
    const wait = opts.waits[failures];
    failures += 1;
    if (wait !== undefined) {
      const n = failures;
      timer = setTimeout(() => {
        node.setAttribute('src', retrySrc(first, n));
      }, wait);
    } else if (opts.fallback !== null) {
      usedFallback = true;
      node.setAttribute('src', opts.fallback);
    }
  }

  node.addEventListener('error', onError);
  return {
    destroy() {
      clearTimeout(timer);
      node.removeEventListener('error', onError);
    },
  };
}

/**
 * The one rule for an image (ADR 0014 item 11), for the export: `attempt` tries `src`, and again
 * after each of `waits` with `?retry=n`; then the fallback gets one try. Null when all failed.
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
  return fallback === null ? null : attempt(fallback);
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
