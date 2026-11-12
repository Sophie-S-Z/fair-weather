import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { inkIncludes } from '../ink-plugin.ts';

export const MARKERS = ['PLACEHOLDER-', '#placeholder', '[PLACEHOLDER]'] as const;

/** Returns each ADR 0010 placeholder marker that appears in `text`. */
export function findPlaceholders(text: string): string[] {
  return MARKERS.filter((marker) => text.includes(marker));
}

/** Fails a production build when any module, chunk, or asset carries a placeholder. */
export function placeholderGuard(): Plugin {
  let production = false;
  const hits: string[] = [];
  const scan = (name: string, text: string): void => {
    for (const marker of findPlaceholders(`${name}\n${text}`)) hits.push(`${marker} in ${name}`);
  };
  return {
    name: 'fair-weather:placeholder-guard',
    apply: 'build',
    configResolved(config) {
      production = config.mode === 'production';
    },
    buildStart() {
      hits.length = 0;
    },
    // Runs before the Ink plugin: compiled Ink JSON splits `#placeholder`, so the raw source
    // (and every INCLUDEd file) is scanned here instead.
    transform: {
      order: 'pre',
      handler(code, id) {
        if (!production) return;
        scan(id, code);
        const path = id.split('?')[0] ?? id;
        if (path.endsWith('.ink')) {
          for (const file of inkIncludes(code, path)) scan(file, readFileSync(file, 'utf8'));
        }
      },
    },
    generateBundle(_options, bundle) {
      if (!production) return;
      for (const [fileName, item] of Object.entries(bundle)) {
        const text = item.type === 'chunk' ? item.code : String(item.source);
        scan(fileName, text);
      }
      if (hits.length > 0) this.error(`Placeholder content in production build:\n${hits.join('\n')}`);
    },
  };
}
