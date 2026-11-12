import { expect, test, type Page } from '@playwright/test';

// Part 1 from Begin to its end (M2.16, spec T7), played twice through the real UI: once by pointer,
// once by keys alone. Dev builds only: ?fast=10 multiplies every sim speed, so a 40 s day is 4 s.
// Each run reads the screen and acts as a player would; it never reaches into the game's state.

test.skip(({ browserName }) => browserName !== 'chromium', 'The whole-year runs are long; Chromium only.');

const FAST = 10;
/** One sim day at ?fast=10: content/tuning.json story.dayLengthSeconds is 40. */
const DAY_MS = (40 * 1_000) / FAST;
const SCENE = { width: 1600, height: 900 }; // content/scenes/kith-meadow.json
/** Pim's feet in content/scenarios/m0.json, where Pim sleeps at chapter 0's dawn. */
const PIM_START = { x: 160, y: 130 };
/** The last option of each bet in play order (content/chapters ch2, ch4, ch5, ch6, ch8). */
const LAST_OPTIONS = ['Wisp', 'Bell', 'Most', 'Yes', 'Many'];
/** The chapters that open a bet; a keyboard player waits for it before pressing keys there. */
const BET_CHAPTERS = /^Chapter [24568]:/;
/** The tools used once a chapter. The rest go on: Sunlight once a day, Respond at each wave. */
const ONCE = ['Bench', 'Bridge', 'Lantern', 'Whisper', 'Thread', 'Fog', 'Wind'];
const TOOLS = ['Wake', 'Respond', ...ONCE, 'Sunlight'];

type Point = { x: number; y: number };
type Mode = 'pointer' | 'keyboard';
/** What a run did: the bet options it chose, and `heading/tool` for each tool it used once. */
type Played = { bets: string[]; used: string[] };

const dev = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: { frames: number; sent: number } }).fairWeather);

/** What a player sees now: the heading, the open dialog, the tools, the activity, and the status. */
function look(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const section = document.querySelector('.activity section');
    const tray = document.querySelector('[role="group"][aria-label="Tools"]');
    const pause = [...document.querySelectorAll('[aria-label="Time"] button')].find(
      (b) => b.textContent.trim() === 'Pause',
    );
    return {
      heading: document.querySelector('h1')?.textContent.trim() ?? '',
      dialog: dialog?.querySelector('h2')?.textContent.trim() ?? null,
      tools: [...(tray?.querySelectorAll('button') ?? [])].map((b) => ({
        text: b.textContent,
        pressed: b.getAttribute('aria-pressed') === 'true',
      })),
      // An activity's name: its aria-label, or the heading that labels it (the fire's scroll).
      activity: section
        ? (section.getAttribute('aria-label') ??
          document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent.trim() ??
          '')
        : null,
      status: document.querySelector('p.status')?.textContent.trim() ?? '',
      focus: document.activeElement?.textContent.trim() ?? '',
      paused: pause?.getAttribute('aria-pressed') === 'true',
      canPause: pause !== undefined && !(pause as HTMLButtonElement).disabled,
    };
  });
}
type Look = Awaited<ReturnType<typeof look>>;

/** The tool's name in the tray (Bench, Sunlight, ...), from a button's text such as "2 Sunlight". */
const toolName = (text: string): string => TOOLS.find((t) => text.includes(t)) ?? text;

/**
 * The middle of a button that may go away as the year moves on: the button under `scope` (a CSS
 * selector) whose text or name has `text`, or its last button; null when there is none. Found in
 * one page.evaluate, since locator actions wait on frames, which software rendering draws slowly.
 */
function buttonAt(page: Page, scope: string, text?: string): Promise<Point | null> {
  return page.evaluate(
    ({ scope, text }) => {
      const buttons = [...(document.querySelector(scope)?.querySelectorAll('button') ?? [])];
      const named = (b: Element) =>
        b.textContent.includes(text ?? '') || (b.getAttribute('aria-label') ?? '').includes(text ?? '');
      const b = text === undefined ? buttons.at(-1) : buttons.find(named);
      const r = b?.getBoundingClientRect();
      return r && r.width > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    },
    { scope, text },
  );
}
async function tap(page: Page, scope: string, text?: string): Promise<string | null> {
  const at = await buttonAt(page, scope, text);
  if (!at) return null;
  const label = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent.trim() ?? '',
    at,
  );
  await page.mouse.click(at.x, at.y);
  return label;
}

/** The middle of the fitted scene: the wide shot shows the whole scene in the canvas. */
async function sceneMiddle(page: Page): Promise<Point> {
  const box = await page.getByRole('application').boundingBox();
  if (!box) throw new Error('The scene is not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Canvas points on a grid where no HUD element is on top, nearest first to `near` (a client point).
 * `fit` keeps them inside the scene as the Meadow fits it; the Cosmos uses the whole canvas.
 */
function canvasPoints(page: Page, step: number, near: Point | 'middle', fit: boolean): Promise<Point[]> {
  return page.evaluate(
    ({ step, near, fit, scene }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return [];
      const r = canvas.getBoundingClientRect();
      const aspect = scene.width / scene.height;
      const w = fit ? Math.min(r.width, r.height * aspect) : r.width;
      const h = fit ? w / aspect : r.height;
      const left = r.left + (r.width - w) / 2;
      const top = r.top + (r.height - h) / 2;
      const out: { x: number; y: number }[] = [];
      for (let y = top + step / 2; y < top + h; y += step)
        for (let x = left + step / 2; x < left + w; x += step)
          if (document.elementFromPoint(x, y) === canvas) out.push({ x, y });
      const n =
        near === 'middle'
          ? { x: left + w / 2, y: top + h / 2 }
          : { x: left + (near.x / scene.width) * w, y: top + (near.y / scene.height) * h };
      return out.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
    },
    { step, near, fit, scene: SCENE },
  );
}

/** The creature the status line names as picked, or null. */
const pickedIn = (status: string): string | null => /^Picked: ([^,.]+)/.exec(status)?.[1] ?? null;

/**
 * Clicks across the canvas with a tool that only picks (Respond), and returns the first `n`
 * creatures it picks other than `skip`, each with the point that picked it. It stops when the
 * heading changes or a dialog opens. The caller pauses first, so the creatures hold still.
 */
async function findCreatures(
  page: Page,
  n: number,
  points: Point[],
  heading: string,
  skip: string[] = [],
): Promise<{ name: string; at: Point }[]> {
  const found: { name: string; at: Point }[] = [];
  for (const at of points) {
    await page.mouse.click(at.x, at.y);
    const now = await look(page);
    if (now.heading !== heading || now.dialog !== null) break;
    const name = pickedIn(now.status);
    if (name !== null && !skip.includes(name) && !found.some((f) => f.name === name)) {
      found.push({ name, at });
      if (found.length === n) break;
    }
  }
  return found;
}

/** Clicks the tray button of `tool` unless it is the active one. */
async function pickTool(page: Page, seen: Look, tool: string): Promise<void> {
  if (seen.tools.some((t) => t.pressed && toolName(t.text) === tool)) return;
  await tap(page, '[aria-label="Tools"]', tool);
}

/** Presses the digit of `tool` in the tray unless it is the active one. */
async function keyTool(page: Page, seen: Look, tool: string): Promise<void> {
  const i = seen.tools.findIndex((t) => toolName(t.text) === tool);
  if (i < 0 || seen.tools[i]?.pressed) return;
  await page.keyboard.press(String(i + 1));
}

/** Presses Tab until the status line names a picked creature other than `not`; returns its name. */
async function tabToAny(page: Page, not: string[] = []): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const name = pickedIn((await look(page)).status);
    if (name !== null && !not.includes(name)) return name;
  }
  return null;
}

/** Presses Tab inside a card until the focused button reads `text`. */
async function tabToButton(page: Page, text: string): Promise<void> {
  for (let i = 0; i < 40 && (await look(page)).focus !== text; i++) await page.keyboard.press('Tab');
  expect((await look(page)).focus).toBe(text);
}

/**
 * The pointer player's turn with a tool it uses once. It pauses first, as a careful player might,
 * so no bet opens under the pointer and the creatures it looks for hold still; with the sim
 * paused, the count of sent command lists moves only with the tool's own command. It returns false
 * to try again later: the pause waits while a bet's answer plays.
 */
async function pointerOnce(page: Page, seen: Look, tool: string): Promise<boolean> {
  if (!seen.canPause) return false;
  if (!seen.paused) await tap(page, '[aria-label="Time"]', 'Pause');
  const sent = (await dev(page)).sent;
  const mid = await sceneMiddle(page);
  let done = true;
  if (tool === 'Wind') {
    await pickTool(page, seen, tool);
    await page.mouse.move(mid.x - 120, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 120, mid.y, { steps: 6 });
    await page.mouse.up();
  } else if (tool === 'Whisper') {
    // Respond only picks: find one creature other than Krit, then whisper to it about Krit.
    await pickTool(page, seen, 'Respond');
    const points = await canvasPoints(page, 16, 'middle', true);
    const [who] = await findCreatures(page, 1, points, seen.heading, ['Krit']);
    done = who !== undefined;
    if (who) {
      await pickTool(page, await look(page), 'Whisper');
      await page.mouse.click(who.at.x, who.at.y);
      await expect(page.getByRole('dialog', { name: 'Whisper about whom?' })).toBeVisible();
      expect(await tap(page, '[role="dialog"]', 'Krit')).toBe('Krit');
      expect(await tap(page, '[role="dialog"]', 'Unkind')).toBe('Unkind');
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  } else if (tool === 'Thread') {
    // In the Cosmos (the wheel zooms out), Respond finds the first two nodes; Thread drags between them.
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.wheel(0, 120);
    await expect(page.getByRole('application', { name: /^The Cosmos/ })).toBeVisible();
    await pickTool(page, seen, 'Respond');
    const points = await canvasPoints(page, 30, 'middle', false);
    const [a, b] = await findCreatures(page, 2, points, seen.heading);
    done = a !== undefined && b !== undefined;
    if (a && b) {
      await pickTool(page, await look(page), 'Thread');
      await page.mouse.move(a.at.x, a.at.y);
      await page.mouse.down();
      await page.mouse.move(b.at.x, b.at.y, { steps: 8 });
      await page.mouse.up();
    }
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.wheel(0, -120);
    await expect(page.getByRole('application', { name: 'The meadow' })).toBeVisible();
  } else {
    // Bench (the spot nearest the middle), Fog (at the middle), Bridge or Lantern (its middle row).
    await pickTool(page, seen, tool);
    await page.mouse.click(mid.x, mid.y);
  }
  if (done) await expect.poll(async () => (await dev(page)).sent).toBeGreaterThan(sent);
  if ((await look(page)).paused) await tap(page, '[aria-label="Time"]', 'Pause');
  return done;
}

/**
 * The keyboard player's turn with a tool it uses once, from the scene: Space pauses first, as for
 * the pointer player, and again after.
 */
async function keyboardOnce(page: Page, seen: Look, tool: string): Promise<boolean> {
  if (!seen.canPause) return false;
  if (!seen.paused) await page.keyboard.press(' ');
  await expect.poll(async () => (await look(page)).paused).toBe(true);
  await keyTool(page, seen, tool);
  const sent = (await dev(page)).sent;
  let done = true;
  if (tool === 'Whisper') {
    // Tab picks a creature other than Krit; Enter opens the card; Tab reaches Krit, then Unkind.
    done = (await tabToAny(page, ['Krit'])) !== null;
    if (done) {
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Whisper about whom?' })).toBeVisible();
      await tabToButton(page, 'Krit');
      await page.keyboard.press('Enter');
      await tabToButton(page, 'Unkind');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  } else if (tool === 'Thread') {
    // Tab picks the first creature and Enter marks it; Tab picks the next and Enter ties them.
    const a = await tabToAny(page);
    done = a !== null;
    if (a !== null) {
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: `Thread from ${a}` })).toBeVisible();
      await tabToAny(page, [a]);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Thread from' })).toHaveCount(0);
    }
  } else {
    // Bench, Fog, Bridge, Lantern, and Wind act at the cursor, which starts at a bench spot; the
    // arrow gives the gust its way.
    if (tool === 'Wind') await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  if (done) await expect.poll(async () => (await dev(page)).sent).toBeGreaterThan(sent);
  await expect(page.getByRole('application')).toBeFocused();
  await page.keyboard.press(' ');
  await expect.poll(async () => (await look(page)).paused).toBe(false);
  return done;
}

/**
 * Plays an interlude's activity or the fire: it presses the activity's buttons, or holds still for
 * six seconds in the Long Night. Returns when the heading changes.
 */
async function playActivity(page: Page, mode: Mode, seen: Look): Promise<void> {
  const changed = async () => (await look(page)).heading !== seen.heading;
  const scope = '.activity section';
  if (seen.activity === 'Hold still') {
    // The one wait that has no condition to await: five seconds with no move and no key.
    await page.waitForTimeout(6_000);
    await expect.poll(changed, { timeout: 10_000 }).toBe(true);
    return;
  }
  for (let i = 0; i < 40 && !(await changed()); i++) {
    const now = await look(page);
    if (now.activity === null) break; // the fire's End screen
    if (mode === 'keyboard') {
      // Focus starts on the first button. A rhythm nobody shares or Moss's bubble moves on with Tab.
      const status = (await page.locator(`${scope} [role="status"]`).allTextContents()).join(' ');
      const stay = now.activity === 'Dream bubbles' && /wobbles and stays/.test(status);
      const tried = now.activity === 'Rhythms at the door' && i > 0;
      if (stay || tried) await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
    } else if (now.activity === 'Rhythms at the door') {
      await tap(page, scope, `Tap rhythm ${String(i + 1)}`);
    } else if (now.activity === 'Dream bubbles') {
      // Every bubble but Moss's pops; with nothing to pop, the player lets them sleep.
      const names = await page
        .locator(`${scope} button[aria-label$="bubble"]`)
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      const pop = names.find((n) => n !== "Pop Moss's bubble");
      await tap(page, scope, pop ?? 'Let them sleep');
    } else {
      const button = { 'The sketch': 'Pass it on', "Wisp's path": 'Trace the next part' }[now.activity];
      await tap(page, scope, button ?? 'Listen');
    }
    await page.waitForTimeout(150);
  }
}

/**
 * The auto-player for Part 1. It answers every bet with its last option and plays each tool as the
 * brief says: Wake finds Pim in chapter 0; Respond holds still at each wave; Sunlight shines at the
 * scene's middle once a day; Whisper whispers unkindly about Krit; Thread joins the first two
 * creatures it finds (by pointer, a drag between their nodes in the Cosmos); Fog, Wind, Bench,
 * Bridge, and Lantern act once at the middle. Interludes and the fire are played to their end.
 */
async function playPart1(page: Page, mode: Mode): Promise<Played> {
  const end = page.getByRole('heading', { name: 'End of Part 1' });
  const played: Played = { bets: [], used: [] };
  let shown = '';
  let framesAtStart = 0;
  /** This chapter's tools still to use once, its bet (answered or not), and its last sunlight. */
  let todo: string[] = [];
  let betDone = false;
  let lastShine = -Infinity;
  while (!(await end.isVisible())) {
    const seen = await look(page);
    if (seen.dialog === 'A bet') {
      // The last option: by pointer its button; by keys Shift+Tab, which wraps from the first.
      if (mode === 'pointer') played.bets.push((await tap(page, '[role="dialog"]')) ?? '');
      else {
        await page.keyboard.press('Shift+Tab');
        played.bets.push((await look(page)).focus);
        await page.keyboard.press('Enter');
      }
      await expect(page.getByRole('dialog', { name: 'A bet' })).toBeHidden();
      betDone = true;
      continue;
    }
    if (seen.heading !== shown) {
      // A new chapter: the player acts once its scene is drawn (the runner takes verbs after a snapshot).
      shown = seen.heading;
      framesAtStart = (await dev(page)).frames;
      const active = seen.tools.find((t) => t.pressed);
      const rest = seen.tools.filter((t) => !t.pressed).map((t) => toolName(t.text));
      // The new tool first, then the rest in tray order; Wake only in chapter 0, to wake Pim.
      todo = [...(active ? [toolName(active.text)] : []), ...rest].filter(
        (t) => ONCE.includes(t) || (t === 'Wake' && seen.heading.startsWith('Chapter 0:')),
      );
      betDone = !BET_CHAPTERS.test(seen.heading);
      lastShine = -Infinity;
    }
    if ((await dev(page)).frames <= framesAtStart || seen.dialog !== null) {
      await page.waitForTimeout(100);
      continue;
    }
    if (seen.activity !== null) {
      await playActivity(page, mode, seen);
      continue;
    }
    if (mode === 'keyboard') {
      await expect(page.getByRole('application')).toBeFocused();
      // Keys go to whatever has focus, and a bet takes it: so wait for this chapter's bet first.
      if (!betDone) {
        await page.waitForTimeout(100);
        continue;
      }
    }
    const tool = todo[0];
    const names = seen.tools.map((t) => toolName(t.text));
    if (tool === 'Wake') {
      todo.shift();
      if (mode === 'pointer') await findPim(page, seen.heading);
      else {
        await tabToName(page, 'Pim');
        await page.keyboard.press('Enter');
      }
      played.used.push(`${seen.heading}/${tool}`);
    } else if (tool !== undefined) {
      const done =
        mode === 'pointer' ? await pointerOnce(page, seen, tool) : await keyboardOnce(page, seen, tool);
      if (done) {
        todo.shift();
        played.used.push(`${seen.heading}/${tool}`);
      }
    } else if (names.includes('Sunlight')) {
      if (Date.now() - lastShine >= DAY_MS) {
        lastShine = Date.now();
        if (mode === 'pointer') {
          await pickTool(page, seen, 'Sunlight');
          const mid = await sceneMiddle(page);
          await page.mouse.click(mid.x, mid.y);
        } else {
          await keyTool(page, seen, 'Sunlight');
          await page.keyboard.press('Enter');
        }
      }
    } else if (names.includes('Respond')) {
      // Hold still: the button by pointer; by keys, H and then Enter at each turn.
      if (mode === 'pointer') {
        await pickTool(page, seen, 'Respond');
        await tap(page, '[aria-label="Reply to the sky"]', 'Hold still');
      } else {
        await keyTool(page, seen, 'Respond');
        await page.keyboard.press('h');
        await page.keyboard.press('Enter');
      }
    }
    await page.waitForTimeout(250);
  }
  return played;
}

/**
 * Clicks across the scene, nearest Pim's spot first, until the status line names Pim, and so wakes
 * each creature it hits (slice.spec.ts pickByPointer). It pauses while it looks.
 */
async function findPim(page: Page, heading: string): Promise<void> {
  const seen = await look(page);
  if (seen.canPause && !seen.paused) await tap(page, '[aria-label="Time"]', 'Pause');
  for (const at of await canvasPoints(page, 16, PIM_START, true)) {
    await page.mouse.click(at.x, at.y);
    const now = await look(page);
    if (pickedIn(now.status) === 'Pim' || now.heading !== heading || now.dialog !== null) break;
  }
  if ((await look(page)).paused) await tap(page, '[aria-label="Time"]', 'Pause');
}

/** Presses Tab until the status line names `name`. */
async function tabToName(page: Page, name: string): Promise<void> {
  for (let i = 0; i < 40 && pickedIn((await look(page)).status) !== name; i++)
    await page.keyboard.press('Tab');
  expect(pickedIn((await look(page)).status)).toBe(name);
}

/** The tools each run uses once, by chapter (the chapter configs' verbs and place kinds). */
const USED_ONCE = [
  'Chapter 0: First Light/Wake',
  'Chapter 3: The Bench/Bench',
  'Chapter 5: The Rumor/Whisper',
  'Chapter 5: The Rumor/Thread',
  'Chapter 6: Fog/Fog',
  'Chapter 6: Fog/Lantern',
  'Chapter 7: Wind/Wind',
  'Chapter 9: Seed and Dance/Bridge',
];

for (const mode of ['pointer', 'keyboard'] as const) {
  test(`Part 1 from Begin to its end, played by ${mode === 'pointer' ? 'pointer' : 'keyboard alone'}`, async ({
    page,
  }) => {
    test.setTimeout(1_200_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/?fast=${String(FAST)}`);
    if (mode === 'pointer') await page.getByRole('button', { name: 'Begin' }).click();
    else {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused();
      await page.keyboard.press('Enter');
    }
    const played = await playPart1(page, mode);

    const end = page.getByRole('heading', { name: 'End of Part 1' });
    await expect(end).toBeFocused();
    expect(played.bets).toEqual(LAST_OPTIONS);
    expect(played.used).toEqual(USED_ONCE);
    expect(errors).toEqual([]);

    // Back to the title, whose Book of Skies now has the year's page.
    if (mode === 'pointer') await page.getByRole('button', { name: 'Back to title' }).click();
    else {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Open the Book of Skies' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Back to title' })).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book of Skies' })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
