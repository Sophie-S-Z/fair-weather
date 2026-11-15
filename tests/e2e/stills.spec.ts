// The still version and asset retry (plan task M4.16, ADR 0014 items 10 and 11). The still version
// runs in Chromium with its 3D APIs off, so the page gets no WebGL context; the retry tests run in the
// browser as it is, and make the worker script or an image fail. Timers run on the page clock, so
// a wait of 1 s or 2 s takes no real time and the test can name it.
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Page } from '@playwright/test';

const STILL_LINE =
  'This browser cannot show the moving valley. You see a still picture of each chapter with all of its text.';
const LINK_LINE = 'This link opens the sandbox. The sandbox needs WebGL, and this browser does not have it.';
const executablePath = process.env['PW_CHROMIUM_PATH'];
const WORKER = '**/src/sim-host/worker.ts*';

// A page in a Chromium of its own, started with --disable-3d-apis (the project's other launch options
// stay, PW_CHROMIUM_PATH included), so the rest of this file runs in the project's browser as it is.
const noGl = test.extend<{ page: Page }>({
  page: async ({ baseURL, playwright }, use) => {
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      args: ['--disable-3d-apis'],
    });
    try {
      const context = await browser.newContext({
        ...playwright.devices['Desktop Chrome'],
        ...(baseURL ? { baseURL } : {}),
      });
      await use(await context.newPage());
    } finally {
      await browser.close();
    }
  },
});

noGl.describe('without WebGL', () => {
  noGl.skip(({ browserName }) => browserName !== 'chromium', 'only Chromium takes --disable-3d-apis');

  const pageHeading = (page: Page) => page.getByRole('heading', { level: 1 });
  const count = async (page: Page): Promise<number> =>
    Number(/of (\d+)$/.exec((await page.getByText(/^Page \d+ of \d+$/).textContent()) ?? '')?.[1]);

  noGl(
    'Begin shows the still line, and Next goes through every page to The End, with the focus on the heading',
    async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Sandbox' })).toBeDisabled();
      await page.getByRole('button', { name: 'Begin' }).click();
      await expect(page.getByText(STILL_LINE)).toBeVisible();
      await expect(pageHeading(page)).toHaveText('First Light');
      await expect(pageHeading(page)).toBeFocused();
      await expect(page.getByRole('img', { name: 'First Light' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
      const total = await count(page);
      expect(total).toBe(21);
      // Every page has its title, its picture, and words.
      await expect(page.locator('article p').nth(1)).not.toBeEmpty();
      for (let i = 1; i < total; i++) {
        await page.getByRole('button', { name: 'Next' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText(`Page ${String(i + 1)} of ${String(total)}`)).toBeVisible();
        await expect(pageHeading(page)).toBeFocused();
      }
      await expect(pageHeading(page)).toHaveText('The Homecoming');
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(pageHeading(page)).toHaveText('The End');
      await expect(pageHeading(page)).toBeFocused();
      await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
      // Back moves to the last page, with the focus on its heading.
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(pageHeading(page)).toHaveText('The Homecoming');
      await expect(pageHeading(page)).toBeFocused();
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('button', { name: 'Back to title' }).click();
      await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
    },
  );

  noGl('axe finds no serious issue on The End page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Begin' }).click();
    const next = page.getByRole('button', { name: 'Next' });
    while ((await pageHeading(page).textContent()) !== 'The End') await next.click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  noGl('axe finds no serious issue on a page with margin notes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Margin notes' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  noGl(
    'a seed link opens the title with a status line instead of the sandbox, and Begin opens the still version',
    async ({ page }) => {
      await page.goto('/#v1.AAAA');
      await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'This link' })).toHaveText(LINK_LINE);
      await expect(page.getByRole('button', { name: 'Sandbox' })).toBeDisabled();
      await page.getByRole('button', { name: 'Begin' }).click();
      await expect(pageHeading(page)).toHaveText('First Light');
      await expect(page.getByText(STILL_LINE)).toBeVisible();
    },
  );

  noGl(
    'Continue opens the page of the autosave chapter and changes no save',
    async ({ page, baseURL, playwright }) => {
      // A save made by a browser that has WebGL, since this one cannot play to make its own.
      const browser = await chromium.launch(executablePath ? { executablePath } : {});
      let save: string | null;
      try {
        const context = await browser.newContext({
          ...playwright.devices['Desktop Chrome'],
          ...(baseURL ? { baseURL } : {}),
        });
        const maker = await context.newPage();
        await maker.goto('/?chapter=3');
        await maker.getByRole('button', { name: 'Begin' }).click();
        await expect(maker.getByRole('heading', { name: 'Chapter 3' })).toBeVisible();
        await expect.poll(() => autosave(maker)).not.toBeNull();
        save = await autosave(maker);
      } finally {
        await browser.close();
      }
      if (save === null) throw new Error('no autosave');

      await page.goto('/');
      await putAutosave(page, save);
      await page.reload();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(pageHeading(page)).toHaveText('The Bench');
      expect(await autosave(page)).toEqual(save);
    },
  );
});

// The autosave holds a Map and a Float32Array, which Playwright's own serializer drops, so it
// travels between the two browsers as text, with those two marked.
const MAP = '__map';
const F32 = '__f32';

/** The autosave as stored in IndexedDB, as text, or null. */
function autosave(page: Page): Promise<string | null> {
  return page.evaluate(
    ({ map, f32 }) =>
      new Promise<string | null>((resolve) => {
        const open = indexedDB.open('fair-weather');
        open.onerror = () => {
          resolve(null);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('saves').objectStore('saves').get('auto');
          get.onsuccess = () => {
            db.close();
            resolve(
              get.result === undefined
                ? null
                : JSON.stringify(get.result, (_key, v: unknown) =>
                    v instanceof Map ? { [map]: [...v] } : v instanceof Float32Array ? { [f32]: [...v] } : v,
                  ),
            );
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      }),
    { map: MAP, f32: F32 },
  );
}

/** Puts the autosave text in the autosave slot. */
function putAutosave(page: Page, text: string): Promise<void> {
  return page.evaluate(
    ({ saved, map, f32 }) =>
      new Promise<void>((resolve, reject) => {
        const value: unknown = JSON.parse(saved, (_key, v: unknown) => {
          const o = v as Record<string, unknown[]> | null;
          if (o && typeof o === 'object' && map in o) return new Map(o[map] as [unknown, unknown][]);
          if (o && typeof o === 'object' && f32 in o) return new Float32Array(o[f32] as number[]);
          return v;
        });
        const open = indexedDB.open('fair-weather', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onerror = () => {
          reject(open.error ?? new Error('open failed'));
        };
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value, 'auto');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => {
            reject(tx.error ?? new Error('put failed'));
          };
        };
      }),
    { saved: text, map: MAP, f32: F32 },
  );
}

/** Counts the requests for the worker script, failing the first `failures` of them (all with Infinity). */
async function failWorker(page: Page, failures: number): Promise<{ requests: () => number }> {
  let seen = 0;
  await page.route(WORKER, async (route) => {
    seen += 1;
    if (seen <= failures) await route.abort();
    else await route.continue();
  });
  return { requests: () => seen };
}

/**
 * Notes the page clock's time at each worker spawn and at each worker error, so a test can name the
 * wait between them exactly, however slow the machine is. A timer fires at its own time on the
 * page clock, whichever way the clock moves on.
 */
async function timeWorker(page: Page): Promise<() => Promise<{ spawns: number[]; fails: number[] }>> {
  await page.addInitScript(() => {
    const log = { spawns: [] as number[], fails: [] as number[] };
    (window as unknown as { workerLog: typeof log }).workerLog = log;
    const Real = window.Worker;
    window.Worker = class extends Real {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        log.spawns.push(Date.now());
        this.addEventListener('error', () => log.fails.push(Date.now()));
      }
    };
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { workerLog: { spawns: number[]; fails: number[] } }).workerLog,
    );
}

/** The time from each failure to the next spawn. */
const waitsOf = ({ spawns, fails }: { spawns: number[]; fails: number[] }): number[] =>
  [1, 2].map((i) => (spawns[i] ?? NaN) - (fails[i - 1] ?? NaN));

/** Moves the page clock on 250 ms at a time until the worker has been spawned `n` times. */
const spawnedBy = (page: Page, log: () => Promise<{ spawns: number[] }>, n: number) =>
  expect
    .poll(async () => {
      await page.clock.runFor(250);
      return (await log()).spawns.length;
    })
    .toBe(n);

test('a worker that fails to load is tried again after 1 s and after 2 s; failing every time gives the still page', async ({
  page,
}) => {
  await page.clock.install();
  const log = await timeWorker(page);
  const worker = await failWorker(page, Infinity);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await spawnedBy(page, log, 3);
  expect(waitsOf(await log())).toEqual([1000, 2000]);
  // The third failure ends it: the game screen gives way to the page of the chapter now playing.
  await expect(page.getByText(STILL_LINE)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First Light');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.clock.runFor(10_000);
  expect(worker.requests()).toBe(3);
  expect((await log()).spawns).toHaveLength(3);
});

test('a worker that fails twice and then loads plays on', async ({ page }) => {
  await page.clock.install();
  const log = await timeWorker(page);
  const worker = await failWorker(page, 2);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await spawnedBy(page, log, 3);
  expect(waitsOf(await log())).toEqual([1000, 2000]);
  expect(worker.requests()).toBe(3);
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await expect(page.locator('.beat-line')).toContainText('The dawn touches the meadow');
  await expect(page.getByText(STILL_LINE)).toHaveCount(0);
});

test('a WebGL context that fails to start gives the still page of the chapter at once, with no retry', async ({
  page,
}) => {
  // The probe at load gets its context; the stage's own request finds none.
  await page.addInitScript(() => {
    const real = Reflect.get(HTMLCanvasElement.prototype, 'getContext') as (...a: unknown[]) => unknown;
    let probed = false;
    const patched = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
        if (!probed) {
          probed = true;
        } else {
          return null;
        }
      }
      return real.call(this, type, ...rest);
    };
    Reflect.set(HTMLCanvasElement.prototype, 'getContext', patched);
  });
  const worker = await failWorker(page, 0);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByText(STILL_LINE)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First Light');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  // No worker was asked for, and none is tried again.
  expect(worker.requests()).toBe(0);
});

test('a sandbox whose WebGL context fails to start says so and goes back to the title, with no error', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The probe at load gets its context; the stage's own request finds none.
  await page.addInitScript(() => {
    const real = Reflect.get(HTMLCanvasElement.prototype, 'getContext') as (...a: unknown[]) => unknown;
    let probed = false;
    const patched = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
        if (!probed) probed = true;
        else return null;
      }
      return real.call(this, type, ...rest);
    };
    Reflect.set(HTMLCanvasElement.prototype, 'getContext', patched);
  });
  await page.goto('/?sandbox=new&seed=7');
  await expect(page.getByRole('status').filter({ hasText: 'could not draw' })).toHaveText(
    'The game could not draw the sandbox. Go back to the title to try again.',
  );
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  expect(errors).toEqual([]);
});

// The journal's drawing of the Fen, written with the dev journey hook as in exports.spec.ts.
// Not the dev server's `?import` module of the same file, which the page needs to start.
const DRAWING = (url: URL): boolean =>
  url.pathname.endsWith('/PLACEHOLDER-journal-fen.svg') && !url.searchParams.has('import');

/** Opens the Fen's journal with its drawing failing `failures` times; the timers run on the page clock. */
async function openFenJournal(page: Page, failures: number): Promise<{ requests: () => number }> {
  await page.clock.install();
  let seen = 0;
  await page.route(DRAWING, async (route) => {
    seen += 1;
    if (seen <= failures) await route.abort();
    else await route.continue();
  });
  await page.goto('/?chapter=16');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: /^Wake as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Murmuration Fen' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await page.evaluate(() => {
    const j = (
      window as unknown as {
        fairWeather: { journey: () => { pages: unknown[]; keepsakes: unknown[] } | null };
      }
    ).fairWeather.journey();
    if (!j) throw new Error('no journey');
    j.pages = [
      {
        valley: 'fen',
        stamp: 'welcomed',
        said: { value: 0.8, strength: 0.9 },
        keepsake: 'starling-feather',
        postcard: null,
        caption: '',
      },
    ];
    j.keepsakes = [{ id: 'starling-feather', given: false }];
  });
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog', { name: 'Travel journal' })).toBeVisible();
  return { requests: () => seen };
}
/** The drawing's address and whether it shows a picture. */
const shown = (page: Page) =>
  page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[role="dialog"] article img');
    return { src: img?.getAttribute('src') ?? '', loaded: (img?.naturalWidth ?? 0) > 0 };
  });
/** Moves the page clock on 1 s at a time (the waits are 1 s and 2 s) until the picture shows. */
const untilShown = (page: Page) =>
  expect
    .poll(async () => {
      await page.clock.fastForward(1000);
      return (await shown(page)).loaded;
    })
    .toBe(true);

test('a journal drawing that fails twice and then loads shows the drawing', async ({ page }) => {
  const drawing = await openFenJournal(page, 2);
  await untilShown(page);
  expect(drawing.requests()).toBe(3);
  expect((await shown(page)).src).toMatch(/PLACEHOLDER-journal-fen\.svg\?retry=2$/);
});

test('a journal drawing that always fails shows the still of its scene', async ({ page }) => {
  const drawing = await openFenJournal(page, Infinity);
  await untilShown(page);
  expect(drawing.requests()).toBe(3);
  expect((await shown(page)).src).toMatch(/PLACEHOLDER-still-fen\.svg$/);
});
