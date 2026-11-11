import { dirname, basename } from 'node:path';
import { Compiler } from 'inkjs/compiler/Compiler';
import { CompilerOptions } from 'inkjs/compiler/CompilerOptions';
import { PosixFileHandler } from 'inkjs/compiler/FileHandler/PosixFileHandler';
import { ErrorType } from 'inkjs/engine/Error';
import type { Plugin } from 'vite';

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

/** Turns `import story from '...ink'` into the compiled story JSON string. */
export function inkPlugin(): Plugin {
  return {
    name: 'fair-weather:ink',
    transform(code, id) {
      const path = id.split('?')[0] ?? id;
      if (!path.endsWith('.ink')) return null;
      for (const m of code.matchAll(INCLUDE)) {
        this.addWatchFile(`${dirname(path)}/${m[1] ?? ''}`);
      }
      return { code: `export default ${JSON.stringify(compileInk(code, path))};`, map: null };
    },
  };
}
