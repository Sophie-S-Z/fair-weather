import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { inkPlugin } from './tools/ink-plugin.ts';
import { placeholderGuard } from './tools/content-validate/placeholder-guard.ts';

// The production build input is index.html only. The dev/ pages are served by
// the dev server and are never built.
export default defineConfig({
  plugins: [svelte(), inkPlugin(), placeholderGuard()],
  build: {
    rolldownOptions: { input: 'index.html' },
  },
});
