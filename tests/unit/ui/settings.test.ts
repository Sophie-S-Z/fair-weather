import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createSettingsStore, type Settings, type SettingsStorage } from '../../../src/ui/settings.ts';

function memory(initial?: unknown) {
  const box: { saved: Settings | undefined } = { saved: undefined };
  const storage: SettingsStorage = {
    load: () => initial,
    save: (s) => {
      box.saved = s;
    },
  };
  return { storage, box };
}

describe('settings store', () => {
  it('has the documented defaults', () => {
    const { storage } = memory();
    expect(get(createSettingsStore(storage, false))).toEqual({
      textScale: 1,
      highContrast: false,
      reducedMotion: false,
      sound: false,
      analytics: false,
    });
  });

  it('takes the reduced-motion default from the system preference', () => {
    expect(get(createSettingsStore(memory().storage, true)).reducedMotion).toBe(true);
  });

  it('persists changes through the storage port', () => {
    const { storage, box } = memory();
    const store = createSettingsStore(storage, false);
    store.update((s) => ({ ...s, textScale: 1.5, sound: true }));
    expect(box.saved).toMatchObject({ textScale: 1.5, sound: true, analytics: false });
  });

  it('loads saved values and falls back per field on bad data', () => {
    const { storage } = memory({ textScale: 2, highContrast: true, sound: 'yes', analytics: true });
    expect(get(createSettingsStore(storage, false))).toEqual({
      textScale: 1,
      highContrast: true,
      reducedMotion: false,
      sound: false,
      analytics: false,
    });
  });
});
