import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { inkPlugin } from './tools/ink-plugin.ts';
import { swPlugin } from './tools/sw-plugin.ts';
import { placeholderGuard } from './tools/content-validate/placeholder-guard.ts';

// The production build input is index.html only. The dev/ pages are served by
// the dev server and are never built.
export default defineConfig({
  plugins: [svelte(), inkPlugin(), placeholderGuard(), swPlugin()],
  build: {
    rolldownOptions: { input: 'index.html' },
    // The pictures under content/ (journal drawings, stills) stay files, not data: URLs, so a failed
    // load is a request that the game can try again (ADR 0014 item 11).
    assetsInlineLimit: (file) => (file.includes('/content/') ? false : undefined),
  },
});
