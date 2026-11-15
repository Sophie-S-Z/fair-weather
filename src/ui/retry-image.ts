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
 * Loads an image off the page, as the PNG export does: it tries `src`, and after each of `waits` it
 * tries again with `?retry=n`. Null when every try failed.
 */
export async function loadImageWithRetry(
  src: string,
  waits: readonly number[],
): Promise<HTMLImageElement | null> {
  for (let n = 0; n <= waits.length; n++) {
    const wait = n > 0 ? waits[n - 1] : undefined;
    if (wait !== undefined) await new Promise((resolve) => setTimeout(resolve, wait));
    const img = new Image();
    img.src = n === 0 ? src : retrySrc(src, n);
    try {
      await img.decode();
      return img;
    } catch {
      // A failed try: the next wait, or null after the last.
    }
  }
  return null;
}
