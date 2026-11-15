import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** The page at `base`, then every emitted file but the worker itself and source maps, sorted. */
export function precacheList(fileNames: readonly string[], base: string): string[] {
  const files = fileNames.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).map((f) => base + f);
  return [base, ...files.sort()];
}

/** The cache name's suffix: 8 hex digits of a hash of the list. */
export function precacheVersion(list: readonly string[]): string {
  return createHash('sha256')
    .update([...list].sort().join('\n'))
    .digest('hex')
    .slice(0, 8);
}

/** Emits `sw.js` at build time: tools/service-worker.js after the precache list and its version. */
export function swPlugin(): Plugin {
  let base = '/';
  return {
    name: 'fair-weather-sw',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const list = precacheList(Object.keys(bundle), base);
      const source = readFileSync(join(import.meta.dirname, 'service-worker.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `self.PRECACHE = ${JSON.stringify(list)};\nself.VERSION = '${precacheVersion(list)}';\n${source}`,
      });
    },
  };
}
