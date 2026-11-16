import type { ActionLog } from '../story/action-log.ts';

/** The three counts the game may send (ADR 0014 item 9). Nothing else leaves the game. */
export type Count =
  | { v: 1; e: 'chapter'; chapter: string }
  | { v: 1; e: 'bet'; chapter: string; right: boolean }
  | { v: 1; e: 'sandbox'; minutes: number };

/** One count for each bet of a chapter's log; right is true only when the answer is the result. */
export function betCounts(chapterId: string, log: ActionLog): Count[] {
  return log.flatMap((e) =>
    e.kind === 'bet' ? [{ v: 1, e: 'bet', chapter: chapterId, right: e.answer === e.result }] : [],
  );
}

/** The request body of a count, built key by key; null for anything that is not a count. */
function body(c: Count): string | null {
  const v: number = c.v; // a caller may pass what the type forbids
  if (v !== 1) return null;
  if (c.e === 'chapter' && typeof c.chapter === 'string')
    return JSON.stringify({ v: 1, e: 'chapter', chapter: c.chapter });
  if (c.e === 'bet' && typeof c.chapter === 'string' && typeof c.right === 'boolean')
    return JSON.stringify({ v: 1, e: 'bet', chapter: c.chapter, right: c.right });
  if (c.e === 'sandbox' && Number.isInteger(c.minutes) && c.minutes >= 1)
    return JSON.stringify({ v: 1, e: 'sandbox', minutes: c.minutes });
  return null;
}

/** Sends nothing without a URL, while off, or for a count that is not one of the three. */
export function createAnalytics(
  url: string | null,
  enabled: () => boolean,
  post: (url: string, body: string) => void,
): { count(c: Count): void } {
  return {
    count(c) {
      if (!url || !enabled()) return;
      const b = body(c);
      if (b !== null) post(url, b);
    },
  };
}

/** One independent request: no cookie, no referrer, nothing kept. A failed send is dropped. */
export function fetchPost(url: string, text: string): void {
  try {
    fetch(url, {
      method: 'POST',
      body: new Blob([text], { type: 'text/plain' }),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    }).catch(() => undefined);
  } catch {
    // Dropped.
  }
}

/** Counts the time with the tab visible; `stop` gives whole minutes, rounded down. */
export function createVisibleTimer(now: () => number, hidden: boolean) {
  let since: number | null = hidden ? null : now();
  let ms = 0;
  return {
    setHidden(h: boolean): void {
      if (h && since !== null) {
        ms += now() - since;
        since = null;
      } else if (!h && since === null) since = now();
    },
    stop(): number {
      if (since !== null) ms += now() - since;
      since = null;
      const minutes = Math.floor(ms / 60_000);
      ms = 0;
      return minutes;
    },
  };
}
