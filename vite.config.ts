import { defineConfig } from 'vite';
import { placeholderGuard } from './tools/content-validate/placeholder-guard.ts';

// The production build input is index.html only. The dev/ pages are served by
// the dev server and are never built.
export default defineConfig({
  plugins: [placeholderGuard()],
  build: {
    rolldownOptions: { input: 'index.html' },
  },
});
