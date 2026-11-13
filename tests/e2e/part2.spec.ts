import { expect as baseExpect, test, type Locator, type Page } from '@playwright/test';
import type { Journey } from '../../src/story/journey.ts';
import type { Point } from './helpers.ts';

// Part 2 from the bridge to "The End" (M3.16), played twice through the real UI: by mouse and keys,
// and by keys alone. Dev builds only: ?fast=10 multiplies every sim speed. Each valley is played as
// its T3 player plays it (tests/golden/players.ts PLAYERS, whose runs the valley T3 counts): the Fen
// walks to Tove every 20 ticks and joins the flock from dusk to dawn; the Hollow walks to the press
// and poses once a day; Halcyon walks to Wisp every 20 ticks and, after three gifts, gives Wisp the
// Fen's feather; the homecoming walks to Pim until they have met, then to the first bench. Every
// postcard is the first one; every journal page is closed at once.
//
// In the scene both runs use the keys (Tab picks a creature, W waves at it): a moving creature can
// be found by pointer only by clicking across the canvas, which at ?fast=10 cannot keep up with a
// wave every 20 ticks (part1.spec.ts and slice.spec.ts find Pim that way). The mouse run clicks
// everything outside the scene: Begin, the hero choice, each postcard card, and each journal.
//
// The run reads the screen as a player would. Two things a player sees on the canvas come from
// elsewhere: the time of day is the dev count of snapshots (one a tick since the chapter started,
// src/main.ts), and the drama sky is where it starts, over the square (sim/world.ts), which the
// hero's own pose keeps there, so a hero at the press poses with the sky on it as the T3 player does.

// The run shares the machine with the rest of the suite; under that load a focus move or a tool's
// first command can take longer than the default 5 s, so each wait here allows 20 s.
const expect = baseExpect.configure({ timeout: 20_000 });

test.skip(({ browserName }) => browserName !== 'chromium', 'The whole-journey runs are long; Chromium only.');

const FAST = 10;
/** The T3 players walk to their guide again at most every 20 ticks. */
const EVERY = 20;
/** Ticks in a day: dayLengthSeconds (content/valleys) × sim.stepsPerSecond (content/tuning.json). */
const DAY = { fen: 540 * 10, hollow: 70 * 10 };
/** The Fen's dusk: fen.duskAt (content/tuning.json) of its day. */
const FEN_DUSK = 0.75 * DAY.fen;
/** The press on the Hollow's square (content/scenarios/hollow.json), where the T3 player stands. */
const PRESS = { x: 800, y: 400 };
/** The Hollow's first bench spot, press-square (content/scenes/hollow.json), where the cursor starts. */
const PRESS_SQUARE = { x: 870, y: 450 };
/** Kith's first bench spot, under the crooked tree (content/scenes/kith-meadow.json), where the cursor starts. */
const BENCH = { x: 600, y: 430 };
/** How far an arrow key moves the cursor (src/input/keyboard.ts CURSOR_STEP). */
const CURSOR_STEP = 20;
/** Each chapter's first story line (content/ink): the runner has taken its first snapshot. */
const INTRO: Record<string, string> = {
  'Murmuration Fen': 'Starlings sit in the reeds',
  'Hearsay Hollow': 'The press runs by the square',
  Halcyon: 'A calm meadow lies over a mirror sea',
  'The Homecoming': 'You walk back over the ridge',
};
/** A diary line a gift from the hero writes for its receiver (content/diary.json gift.got.give). */
const HERO_GAVE = /Hero gave me a berry/;
const TOOLS = ['Walk', 'Manner', 'Join', 'Pose', 'Keepsake'] as const;
type Tool = (typeof TOOLS)[number];

/** What a player sees now: the heading, the open dialog, the tools, the status, the diary, and the time. */
function look(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const tray = document.querySelector('[role="group"][aria-label="Tools"]');
    const toggle = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Diary and notes',
    );
    return {
      heading: document.querySelector('h1')?.textContent.trim() ?? '',
      dialog: dialog
        ? (document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent.trim() ?? '')
        : null,
      tools: [...(tray?.querySelectorAll('button') ?? [])].map((b) => ({
        text: b.textContent,
        pressed: b.getAttribute('aria-pressed') === 'true',
      })),
      status: document.querySelector('p.status')?.textContent.trim() ?? '',
      drawerOpen: toggle?.getAttribute('aria-expanded') === 'true',
      diary: document.getElementById('diary-title')?.textContent.trim() ?? null,
      lines: [...document.querySelectorAll('[aria-labelledby="diary-lines"] li')].map((li) =>
        li.textContent.trim(),
      ),
      keepsakes: [...document.querySelectorAll('[role="group"][aria-label="Keepsakes"] button')].map((b) =>
        b.textContent.trim(),
      ),
      ticks: (window as unknown as { fairWeather: { snapshots: number } }).fairWeather.snapshots,
    };
  });
}
type Look = Awaited<ReturnType<typeof look>>;

/** The creature the status line names as picked: alone, or after the Walk tool's spot. */
const pickedIn = (status: string): string | null => /(?:^|\. )Picked: ([^,.]+)/.exec(status)?.[1] ?? null;
const toolName = (text: string): Tool | null => TOOLS.find((t) => text.includes(t)) ?? null;

/** The lines `now` adds to `before`: a diary keeps only its newest lines, so old ones drop off its front. */
function added(before: readonly string[], now: readonly string[]): string[] {
  for (let k = Math.max(0, before.length - now.length); k < before.length; k++)
    if (before.slice(k).every((line, i) => now[i] === line)) return now.slice(before.length - k);
  return [...now];
}

/** The player's hands: each move the T3 players make, done by keys or, outside the scene, by mouse. */
interface Hands {
  /** Starts a turn in chapter `heading`: its moves stop when a card opens or the chapter ends. */
  turnIn(heading: string): void;
  begin(): Promise<void>;
  /** The first hero, named Rain. */
  chooseHero(): Promise<void>;
  /** Waves at `who` with the Walk tool, which the hero then follows; false when a card opened. */
  wave(who: string): Promise<boolean>;
  /** Walks to scene point `to`, the cursor starting at `from`; false when a card opened. */
  walkTo(to: Point, from: Point): Promise<boolean>;
  /** Uses Join (it toggles flying) or Pose once, then goes back to the Walk tool; false when it could not. */
  use(tool: 'Join' | 'Pose'): Promise<boolean>;
  /** Gives the starling feather to the picked creature; false once the hero no longer holds it. */
  giveFeather(): Promise<boolean>;
  /** Opens the drawer at the diary of `who`, which it picks. */
  openDiary(who: string): Promise<void>;
  /** Sends the first postcard on the card. */
  postcard(): Promise<void>;
  closeJournal(): Promise<void>;
}

/** Whether `l` has focus now, without waiting. */
const isFocused = (l: Locator) => l.evaluate((el) => el === document.activeElement);

function keyboardHands(page: Page): Hands {
  /** The chapter of the turn the moves are in. */
  let at = '';
  /**
   * Whether the scene still takes the move's keys: a card that opens takes focus, and the main loop
   * answers it; a chapter that ends under the move ends the move. Each move checks before each
   * key, so its keys do not land on the card or in the next chapter.
   */
  const ok = (now: Look) => now.dialog === null && now.heading === at;
  const free = async () => ok(await look(page));
  /**
   * Presses the digit of `tool` in the tray unless it is the active one; false when a card opened
   * or the chapter changed under the move, so the tray no longer has the tool.
   */
  const keyTool = async (tool: Tool) => {
    const seen = await look(page);
    const i = seen.tools.findIndex((t) => toolName(t.text) === tool);
    if (!ok(seen) || i < 0) return false;
    const { tools } = seen;
    if (!tools[i]?.pressed) await page.keyboard.press(String(i + 1));
    const settled = (now: Look) => {
      const t = now.tools[i];
      return !ok(now) || t === undefined || toolName(t.text) !== tool || t.pressed;
    };
    await expect.poll(async () => settled(await look(page))).toBe(true);
    const now = await look(page);
    return ok(now) && now.tools[i]?.pressed === true && toolName(now.tools[i].text) === tool;
  };
  /** Presses Tab until the status line names `who` as picked; false when a card opened. */
  const tabTo = async (who: string) => {
    for (let i = 0; i < 80; i++) {
      const now = await look(page);
      if (!ok(now)) return false;
      if (pickedIn(now.status) === who) return true;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Tab never picked ${who}`);
  };
  /** Presses `key` unless a card has opened; false when one has. */
  const press = async (key: string) => {
    if (!(await free())) return false;
    await page.keyboard.press(key);
    return true;
  };
  return {
    turnIn(heading) {
      at = heading;
    },
    async begin() {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused();
      await page.keyboard.press('Enter');
    },
    async chooseHero() {
      // Focus moves to the first hero, which is chosen; then the name, then the button.
      await expect(page.getByRole('radio').first()).toBeFocused();
      await expect(page.getByRole('radio').first()).toBeChecked();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('textbox', { name: 'Name your hero' })).toBeFocused();
      await page.keyboard.type('Rain');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Wake as Rain' })).toBeFocused();
      await page.keyboard.press('Enter');
    },
    async wave(who) {
      if (!(await keyTool('Walk'))) return false;
      await expect(page.getByRole('application')).toBeFocused();
      return (await tabTo(who)) && press('w');
    },
    async walkTo(to, from) {
      if (!(await keyTool('Walk'))) return false;
      const dx = Math.round((to.x - from.x) / CURSOR_STEP);
      const dy = Math.round((to.y - from.y) / CURSOR_STEP);
      const keys = [
        ...Array<string>(Math.abs(dx)).fill(dx < 0 ? 'ArrowLeft' : 'ArrowRight'),
        ...Array<string>(Math.abs(dy)).fill(dy < 0 ? 'ArrowUp' : 'ArrowDown'),
      ];
      for (const key of keys) if (!(await press(key))) return false;
      return press('Enter');
    },
    async use(tool) {
      const done = (await keyTool(tool)) && (await press('Enter'));
      await keyTool('Walk');
      return done;
    },
    async giveFeather() {
      if (!(await keyTool('Keepsake'))) return true;
      // Enter gives the first keepsake the hero holds, which is the feather while it has it.
      const held = (await look(page)).keepsakes[0]?.includes('starling feather') ?? false;
      if (held) await press('Enter');
      await keyTool('Walk');
      return held;
    },
    async openDiary(who) {
      // X zooms into the picked creature's Soul view, which opens the drawer at its diary without
      // taking focus from the scene; Z goes back to the Meadow, and the drawer stays open.
      if (!(await tabTo(who)) || !(await press('x'))) return;
      await expect(page.getByRole('region', { name: `Diary: ${who}` })).toBeVisible();
      if (!(await press('z'))) return;
      await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
    },
    async postcard() {
      const card = page.getByRole('dialog', { name: 'A postcard home' });
      // Focus moves to the first postcard when the card opens. A Tab the player pressed in the
      // scene as it opened lands on the card, and Tab goes round the card's buttons.
      const buttons = card.getByRole('button');
      await expect(card.locator(':focus')).toHaveCount(1);
      for (let i = 0; i < 4 && !(await isFocused(buttons.first())); i++) await page.keyboard.press('Tab');
      await expect(buttons.first()).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(card).toBeHidden();
    },
    async closeJournal() {
      const journal = page.getByRole('dialog', { name: 'Travel journal' });
      await expect(journal.locator(':focus')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(journal).toBeHidden();
    },
  };
}

/** The keys in the scene; the mouse for Begin, the hero choice, the postcard cards, and the journal. */
function mouseHands(page: Page): Hands {
  return {
    ...keyboardHands(page),
    async begin() {
      await page.getByRole('button', { name: 'Begin' }).click();
    },
    async chooseHero() {
      await page.getByRole('radio').first().click();
      await page.getByRole('textbox', { name: 'Name your hero' }).fill('Rain');
      await page.getByRole('button', { name: 'Wake as Rain' }).click();
    },
    async postcard() {
      const card = page.getByRole('dialog', { name: 'A postcard home' });
      await card.getByRole('button').first().click();
      await expect(card).toBeHidden();
    },
    async closeJournal() {
      const journal = page.getByRole('dialog', { name: 'Travel journal' });
      await journal.getByRole('button', { name: 'Close' }).click();
      await expect(journal).toBeHidden();
      // This player's keys go to the scene, so a click on Close must give focus back to it.
      await expect(page.getByRole('application')).toBeFocused();
    },
  };
}

/**
 * What a run did: the journal pages it closed, each valley's local moves (the first time each), and
 * the hero's gifts to Wisp that Wisp's diary showed.
 */
type Played = { journals: string[]; moves: string[]; gifts: number };

/** One valley's T3 player, as state the turns share. */
type Valley = {
  lastWave: number;
  joined: boolean;
  walked: boolean;
  arrived: boolean;
  posedOn: number;
  gifts: number;
  met: boolean;
  feather: boolean;
  seated: boolean;
  diary: string[];
};
const fresh = (): Valley => ({
  lastWave: -Infinity,
  joined: false,
  walked: false,
  arrived: false,
  posedOn: -1,
  gifts: 0,
  met: false,
  feather: true,
  seated: false,
  diary: [],
});

/** Reads the new lines in `who`'s diary when the drawer shows it, and returns them. */
function newLines(seen: Look, v: Valley, who: string): string[] {
  if (seen.diary !== `Diary: ${who}`) return [];
  const lines = added(v.diary, seen.lines);
  v.diary = seen.lines;
  return lines;
}

/** One turn of the valley's T3 player (tests/golden/players.ts), from what `seen` shows. */
async function turn(hands: Hands, seen: Look, v: Valley, played: Played): Promise<void> {
  const t = seen.ticks;
  const move = (m: string) => {
    if (!played.moves.includes(m)) played.moves.push(m);
  };
  /** Waves at `who` every EVERY ticks; with `diary`, the drawer then shows its diary. */
  const wave = async (who: string, diary = false) => {
    if (t - v.lastWave < EVERY || !(await hands.wave(who))) return;
    v.lastWave = t;
    move(`Walk to ${who}`);
    if (diary && !seen.drawerOpen) await hands.openDiary(who);
  };
  hands.turnIn(seen.heading);
  switch (seen.heading) {
    case 'Murmuration Fen': {
      // walksToTove(true): Tove every 20 ticks; the flock from fen.duskAt of each day to dawn.
      await wave('Tove');
      const dusk = t % DAY.fen >= FEN_DUSK;
      if (dusk !== v.joined && (await hands.use('Join'))) {
        v.joined = dusk;
        move(dusk ? 'Join at dusk' : 'Land at dawn');
      }
      return;
    }
    case 'Hearsay Hollow': {
      // walksToSquare(true): to the press, then a pose once a day while the sky is on the hero.
      if (!v.walked) v.walked = await hands.walkTo(PRESS, PRESS_SQUARE);
      // The Walk tool's status names the creature nearest its spot, the press: the hero once there.
      v.arrived ||= v.walked && /, by Hero(\.|$)/.test(seen.status);
      const day = Math.floor(t / DAY.hollow);
      if (v.arrived && day !== v.posedOn && (await hands.use('Pose'))) {
        v.posedOn = day;
        move('Pose at the press');
      }
      return;
    }
    case 'Halcyon': {
      // givesToWisp(true): Wisp every 20 ticks; after three gifts, the Fen's feather.
      // The hero's gifts are read in Wisp's diary, which the drawer shows while Wisp is picked.
      v.gifts += newLines(seen, v, 'Wisp').filter((l) => HERO_GAVE.test(l)).length;
      played.gifts = v.gifts;
      await wave('Wisp', true);
      // The hero follows Wisp, so a try soon comes within reach; the tray shows when it is given.
      if (v.gifts >= 3 && v.feather) {
        v.feather = await hands.giveFeather();
        if (!v.feather) move('Feather to Wisp after three gifts');
      }
      return;
    }
    case 'The Homecoming': {
      // walksToPimThenBench: Pim every 20 ticks until they have met (a line about the hero in
      // Pim's diary), then the first bench.
      v.met ||= newLines(seen, v, 'Pim').some((l) => l.includes('Hero'));
      if (!v.met) await wave('Pim', true);
      else if (!v.seated) {
        v.seated = await hands.walkTo(BENCH, BENCH);
        if (v.seated) move('Bench after meeting Pim');
      }
      return;
    }
  }
}

/**
 * The auto-player for Part 2: the first hero, named Rain, at the bridge; then each valley's T3
 * player, the first postcard on each card, and each journal page closed. Returns at "The End".
 */
async function playPart2(page: Page, hands: Hands): Promise<Played> {
  const played: Played = { journals: [], moves: [], gifts: 0 };
  let shown = '';
  let valley = fresh();
  for (;;) {
    const seen = await look(page);
    if (seen.heading === 'The End') return played;
    if (seen.dialog === 'A postcard home') {
      await hands.postcard();
      continue;
    }
    if (seen.dialog === 'Travel journal') {
      // The valley's new page opens when its postcard has gone; closing it starts the next valley.
      played.journals.push(seen.heading);
      await hands.closeJournal();
      continue;
    }
    if (seen.dialog !== null) throw new Error(`An unexpected dialog: ${seen.dialog}`);
    if (seen.heading !== shown) {
      shown = seen.heading;
      valley = fresh();
      if (shown === 'The Bridge') {
        await hands.chooseHero();
        await expect(page.getByRole('heading', { level: 1, name: 'The Bridge' })).toBeHidden();
      } else {
        // A valley's player starts once its runner has taken the first snapshot: the intro line shows.
        await expect(page.locator('.beat-line')).toContainText(INTRO[shown] ?? `no intro for ${shown}`);
      }
      continue;
    }
    await turn(hands, seen, valley, played);
    // The next turn comes EVERY ticks on, or sooner when a card opens or the chapter changes.
    await expect
      .poll(
        async () => {
          const now = await look(page);
          return now.dialog !== null || now.heading !== seen.heading || now.ticks >= seen.ticks + EVERY;
        },
        { intervals: [25, 50, 100], timeout: 60_000 },
      )
      .toBe(true);
  }
}

for (const mode of ['mouse', 'keyboard'] as const) {
  test(`Part 2 from the bridge to The End, played by ${mode === 'mouse' ? 'mouse and keys' : 'keyboard alone'}`, async ({
    page,
  }) => {
    test.setTimeout(1_200_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/?chapter=16&fast=${String(FAST)}`);
    const hands = mode === 'mouse' ? mouseHands(page) : keyboardHands(page);
    await hands.begin();
    await expect(page.getByRole('heading', { level: 1, name: 'The Bridge' })).toBeVisible();
    const played = await playPart2(page, hands);
    test.info().annotations.push({ type: 'played', description: JSON.stringify(played) });

    // The End takes focus, with the sixth verse under it, its template filled.
    await expect(page.getByRole('heading', { level: 1, name: 'The End' })).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'The Sky Came Down' })).toBeVisible();
    const verse = page.locator('main.end h2 + p');
    await expect(verse).toHaveText(/\S/);
    await expect(verse).not.toContainText('{');
    expect(played.journals).toEqual(['Murmuration Fen', 'Hearsay Hollow', 'Halcyon']);
    // Two moves wait on meetings the run does not arrange: the hero meets Wisp at most once a day,
    // and Wisp chooses by the third dusk, so a day without a meeting leaves no time for the feather
    // (1 of 6 runs); meeting Pim before the homecoming's twist depends on Kith's live carry.
    const given = played.gifts >= 3 && played.moves.includes('Feather to Wisp after three gifts');
    const waits = ['Feather to Wisp after three gifts', 'Bench after meeting Pim'];
    expect(played.gifts).toBeGreaterThan(0);
    expect(played.moves.filter((m) => !waits.includes(m))).toEqual([
      'Walk to Tove',
      'Join at dusk',
      'Pose at the press',
      'Walk to Wisp',
      'Walk to Pim',
    ]);
    // The journey kept the hero, each valley's first postcard, and Wisp's choice: home with the feather.
    const journey = await page.evaluate(() => {
      const j = (
        window as unknown as { fairWeather: { journey: () => Journey | null } }
      ).fairWeather.journey();
      return j && { ...j, kithStart: null };
    });
    expect(journey?.hero).toEqual({ kind: 'lantern', name: 'Rain' });
    expect(journey?.pages.map((p) => [p.valley, p.postcard])).toEqual([
      ['fen', 'generosity'],
      ['hollow', 'patience'],
      ['halcyon', 'generosity'],
      ['home', null],
    ]);
    expect(journey?.keepsakes).toContainEqual({ id: 'starling-feather', given });
    if (given) expect(journey?.wisp).toBe('home');
    else expect(journey?.wisp).not.toBeNull();
    expect(errors).toEqual([]);
  });
}
