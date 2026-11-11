import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { CompilerOptions } from 'inkjs/compiler/CompilerOptions';
import { ErrorType } from 'inkjs/engine/Error';
import { RigSchema } from '../../src/render/line/rig.ts';
import { TuningSchema } from '../../src/sim/tuning.ts';
import { MARKERS } from './placeholder-guard.ts';

export interface ValidationResult {
  errors: string[];
  counts: Record<string, number>;
}

function filesIn(dir: string, ext: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(ext))
        .sort()
    : [];
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Checks tuning, rigs, and Ink under `root/content`, and counts placeholder occurrences by kind. */
export function validateContent(root: string): ValidationResult {
  const errors: string[] = [];
  const content = join(root, 'content');

  const tuningPath = join(content, 'tuning.json');
  try {
    TuningSchema.parse(JSON.parse(readFileSync(tuningPath, 'utf8')));
  } catch (e) {
    errors.push(`tuning.json: ${(e as Error).message}`);
  }
  for (const f of filesIn(join(content, 'rigs'), '.json')) {
    try {
      RigSchema.parse(JSON.parse(readFileSync(join(content, 'rigs', f), 'utf8')));
    } catch (e) {
      errors.push(`${f}: ${(e as Error).message}`);
    }
  }
  for (const f of filesIn(join(content, 'ink'), '.ink')) {
    try {
      const options = new CompilerOptions(null, [], false, (message, type) => {
        if (type === ErrorType.Error) errors.push(`${f}: ${message}`);
      });
      new Compiler(readFileSync(join(content, 'ink', f), 'utf8'), options).Compile();
    } catch (e) {
      errors.push(`${f}: ${(e as Error).message}`);
    }
  }

  const counts: Record<string, number> = Object.fromEntries(MARKERS.map((m) => [m, 0]));
  for (const file of walk(content)) {
    const text = file.endsWith('.json') || file.endsWith('.ink') ? readFileSync(file, 'utf8') : '';
    const haystack = `${file.slice(content.length)}\n${text}`;
    for (const marker of MARKERS) counts[marker] = (counts[marker] ?? 0) + haystack.split(marker).length - 1;
  }
  return { errors, counts };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
  const { errors, counts } = validateContent(root);
  for (const [kind, n] of Object.entries(counts)) console.log(`${kind} ${String(n)}`);
  for (const e of errors) console.error(e);
  if (errors.length > 0) process.exitCode = 1;
}
