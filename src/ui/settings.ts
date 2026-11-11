import { writable, type Writable } from 'svelte/store';
import { z } from 'zod';

export interface Settings {
  textScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  reducedMotion: boolean;
  sound: boolean;
  analytics: false;
}

export interface SettingsStorage {
  load(): unknown;
  save(s: Settings): void;
}

const scale = z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]);

export function createSettingsStore(
  storage: SettingsStorage,
  systemReducedMotion: boolean,
): Writable<Settings> {
  const defaults: Settings = {
    textScale: 1,
    highContrast: false,
    reducedMotion: systemReducedMotion,
    sound: false,
    analytics: false,
  };
  let raw: unknown;
  try {
    raw = storage.load();
  } catch {
    raw = undefined;
  }
  const o: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {};
  const settings: Settings = {
    textScale: scale.catch(defaults.textScale).parse(o['textScale']),
    highContrast: z.boolean().catch(defaults.highContrast).parse(o['highContrast']),
    reducedMotion: z.boolean().catch(defaults.reducedMotion).parse(o['reducedMotion']),
    sound: z.boolean().catch(defaults.sound).parse(o['sound']),
    analytics: false,
  };
  const store = writable<Settings>(settings);
  store.subscribe((s) => {
    try {
      storage.save({ ...s, analytics: false });
    } catch {
      // Blocked storage must not break the game.
    }
  });
  const { subscribe, set, update } = store;
  return {
    subscribe,
    set: (s) => {
      set({ ...s, analytics: false });
    },
    update: (f) => {
      update((s) => ({ ...f(s), analytics: false }));
    },
  };
}
