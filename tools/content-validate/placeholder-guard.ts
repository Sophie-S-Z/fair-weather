import type { Plugin } from 'vite';

const MARKERS = ['PLACEHOLDER-', '#placeholder', '[PLACEHOLDER]'] as const;

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
    transform(code, id) {
      if (production) scan(id, code);
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
