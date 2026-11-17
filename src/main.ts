// The composition root: the only file that wires every module together.
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/style.css';
import { Application } from 'pixi.js';
import { mount } from 'svelte';
import { createAudioEngine, enableOnGesture } from './audio/engine.ts';
import type { StickerStorage } from './persist/stickers.ts';
import { PALETTE } from './render/palette.ts';
import { createTableView } from './render/table-view.ts';
import { rigs } from './rigs.ts';
import { CAST } from './toy/cast.ts';
import { createTable } from './toy/table.ts';
import { CAST_IDS, type CastId } from './toy/types.ts';
import App from './ui/App.svelte';
import { createSettingsStore } from './ui/settings.ts';

const SETTINGS_KEY = 'fair-weather.settings';

/** Where the cast stands when the toybox opens: spread out, never in rows. */
const START: readonly [CastId, number, number][] = [
  ['pim', 380, 560],
  ['krit', 560, 700],
  ['echo', 720, 520],
  ['moss', 900, 790],
  ['bell', 1060, 560],
  ['quill', 1240, 690],
  ['tove', 300, 790],
  ['frog', 640, 830],
  ['snail', 1190, 840],
  ['toadstool', 820, 640],
  ['kite', 1400, 560],
  ['glassling', 1010, 700],
];

/** `localStorage`, or null when the browser blocks it. */
function localStore(): StickerStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const storage = localStore();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settings = createSettingsStore(
    {
      load: () => JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null') as unknown,
      save: (s) => storage?.setItem(SETTINGS_KEY, JSON.stringify(s)),
    },
    reduced,
  );

  const isCast = (id: string): id is CastId => (CAST_IDS as readonly string[]).includes(id);
  const audio = createAudioEngine(
    () => new AudioContext(),
    (who) => (isCast(who) ? { timbre: CAST[who].timbre, note: CAST[who].note } : undefined),
  );
  let soundOn = false;
  settings.subscribe((s) => {
    if (soundOn !== s.sound) {
      soundOn = s.sound;
      if (!s.sound) audio.setEnabled(false);
    }
  });
  enableOnGesture(audio, window, () => soundOn);

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: PALETTE.page,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio),
  });

  const target = document.getElementById('app');
  if (!target) throw new Error('No #app element');
  const table = createTable({ seed: Date.now() & 0xffff, cast: START });
  const view = createTableView(rigs);
  mount(App, { target, props: { app, table, view, rigs, settings, audio, storage } });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Playing offline is a bonus: a refused registration (blocked site data) changes nothing else.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }
}

void main();
