import { existsSync, readFileSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { Compiler } from 'inkjs/compiler/Compiler';
import { CompilerOptions } from 'inkjs/compiler/CompilerOptions';
import { PosixFileHandler } from 'inkjs/compiler/FileHandler/PosixFileHandler';
import { ErrorType } from 'inkjs/engine/Error';
import type { Plugin } from 'vite';
import type {} from 'vitest/config'; // adds the configureVitest hook to Plugin

/** Compiles an Ink file (with its INCLUDEs, resolved beside it) to the story JSON string. Throws with the Ink line on error. */
export function compileInk(source: string, path: string): string {
  const errors: string[] = [];
  const options = new CompilerOptions(
    basename(path),
    [],
    false,
    (message, type) => {
      if (type === ErrorType.Error) errors.push(message);
    },
    new PosixFileHandler(dirname(path)),
  );
  let json: unknown = null;
  try {
    json = new Compiler(source, options).Compile().ToJson();
  } catch (e) {
    if (errors.length === 0) errors.push((e as Error).message);
  }
  if (errors.length > 0 || typeof json !== 'string') {
    throw new Error(`Ink compile failed in ${path}:\n${errors.join('\n')}`);
  }
  return json;
}

const INCLUDE = /^\s*INCLUDE\s+(.+?)\s*$/gm;

/** Returns the absolute paths of every file `source` INCLUDEs, nested ones too. */
export function inkIncludes(source: string, path: string, seen = new Set<string>()): string[] {
  for (const m of source.matchAll(INCLUDE)) {
    const file = resolve(dirname(path), m[1] ?? '');
    if (seen.has(file)) continue;
    seen.add(file);
    if (existsSync(file)) inkIncludes(readFileSync(file, 'utf8'), file, seen);
  }
  return [...seen];
}

/** The INCLUDEd files' text, so a cached compile goes stale when any of them changes. */
export function inkCacheKey(source: string, path: string): string {
  return inkIncludes(source, path)
    .map((file) => (existsSync(file) ? readFileSync(file, 'utf8') : ''))
    .join('\0');
}

/** Turns `import story from '...ink'` into the compiled story JSON string. */
export function inkPlugin(): Plugin {
  return {
    name: 'fair-weather:ink',
    configureVitest({ defineCacheKeyGenerator }) {
      defineCacheKeyGenerator(({ id, sourceCode }) => {
        const path = id.split('?')[0] ?? id;
        return path.endsWith('.ink') ? inkCacheKey(sourceCode, path) : undefined;
      });
    },
    transform(code, id) {
      const path = id.split('?')[0] ?? id;
      if (!path.endsWith('.ink')) return null;
      for (const file of inkIncludes(code, path)) this.addWatchFile(file);
      return { code: `export default ${JSON.stringify(compileInk(code, path))};`, map: null };
    },
  };
}
