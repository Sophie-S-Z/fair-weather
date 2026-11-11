import { mount } from 'svelte';
import App from './ui/App.svelte';
import { createSettingsStore, type SettingsStorage } from './ui/settings.ts';

const KEY = 'fair-weather.settings';

const storage: SettingsStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  },
  save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Blocked storage: settings last for this visit only.
    }
  },
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = createSettingsStore(storage, reduced);

const app = document.getElementById('app');
if (app) mount(App, { target: app, props: { settings, hasSave: false, onBegin: () => undefined } });
