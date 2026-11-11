import { defineConfig } from 'vite';

// The production build input is index.html only. The dev/ pages are served by
// the dev server and are never built.
export default defineConfig({
  build: {
    rolldownOptions: { input: 'index.html' },
  },
});
