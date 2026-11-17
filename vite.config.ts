import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { swPlugin } from './tools/sw-plugin.ts';
import { placeholderGuard } from './tools/content-validate/placeholder-guard.ts';

export default defineConfig({
  plugins: [svelte(), placeholderGuard(), swPlugin()],
  // Pixi.js alone is about 500 kB; the toybox ships as one offline bundle on purpose.
  build: { rolldownOptions: { input: 'index.html' }, chunkSizeWarningLimit: 700 },
});
