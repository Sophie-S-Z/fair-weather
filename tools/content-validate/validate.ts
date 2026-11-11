import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { PosixFileHandler } from 'inkjs/compiler/FileHandler/PosixFileHandler';
import { CompilerOptions } from 'inkjs/compiler/CompilerOptions';
import { ErrorType } from 'inkjs/engine/Error';
import { CastSchema } from '../../src/render/cast.ts';
import { RigSchema } from '../../src/render/line/rig.ts';
import { PaletteSchema } from '../../src/render/palette.ts';
import { SceneSchema } from '../../src/render/scene.ts';
import { TuningSchema } from '../../src/sim/tuning.ts';
import { FlagsSchema } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
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

/** Checks tuning, rigs, palettes, scenes, cast, chapter camera names, and Ink under `root/content`, and counts placeholder occurrences by kind. */
export function validateContent(root: string): ValidationResult {
  const errors: string[] = [];
  const content = join(root, 'content');

  const tuningPath = join(content, 'tuning.json');
  try {
    TuningSchema.parse(JSON.parse(readFileSync(tuningPath, 'utf8')));
  } catch (e) {
    errors.push(`tuning.json: ${(e as Error).message}`);
  }
  const flagsPath = join(content, 'flags.json');
  if (existsSync(flagsPath)) {
    try {
      FlagsSchema.parse(JSON.parse(readFileSync(flagsPath, 'utf8')));
    } catch (e) {
      errors.push(`flags.json: ${(e as Error).message}`);
    }
  }
  for (const f of filesIn(join(content, 'chapters'), '.json')) {
    try {
      ChapterSchema.parse(JSON.parse(readFileSync(join(content, 'chapters', f), 'utf8')));
    } catch (e) {
      errors.push(`${f}: ${(e as Error).message}`);
    }
  }
  for (const [dir, schema] of [
    ['rigs', RigSchema],
    ['palettes', PaletteSchema],
    ['scenes', SceneSchema],
    ['cast', CastSchema],
  ] as const) {
    for (const f of filesIn(join(content, dir), '.json')) {
      try {
        schema.parse(JSON.parse(readFileSync(join(content, dir, f), 'utf8')));
      } catch (e) {
        errors.push(`${f}: ${(e as Error).message}`);
      }
    }
  }
  // Every camera shot a chapter beat names must be defined by a scene.
  const shots = new Set<string>();
  for (const f of filesIn(join(content, 'scenes'), '.json')) {
    const parsed = SceneSchema.safeParse(JSON.parse(readFileSync(join(content, 'scenes', f), 'utf8')));
    if (parsed.success) for (const name of Object.keys(parsed.data.cameras)) shots.add(name);
  }
  for (const f of filesIn(join(content, 'chapters'), '.json')) {
    const parsed = ChapterSchema.safeParse(JSON.parse(readFileSync(join(content, 'chapters', f), 'utf8')));
    if (!parsed.success) continue;
    for (const beat of parsed.data.beats) {
      for (const action of beat.actions) {
        if ('camera' in action && !shots.has(action.camera)) {
          errors.push(`${f}: beat ${beat.id} names camera shot ${action.camera}, which no scene defines`);
        }
      }
    }
  }
  for (const f of filesIn(join(content, 'ink'), '.ink')) {
    try {
      const options = new CompilerOptions(
        f,
        [],
        false,
        (message, type) => {
          if (type === ErrorType.Error) errors.push(`${f}: ${message}`);
        },
        new PosixFileHandler(join(content, 'ink')),
      );
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
