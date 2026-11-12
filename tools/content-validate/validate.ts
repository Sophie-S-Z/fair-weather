import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { PosixFileHandler } from 'inkjs/compiler/FileHandler/PosixFileHandler';
import { CompilerOptions } from 'inkjs/compiler/CompilerOptions';
import { ErrorType } from 'inkjs/engine/Error';
import { AudioSchema } from '../../src/audio/schema.ts';
import { VoiceSchema } from '../../src/audio/voices.ts';
import { VersesSchema } from '../../src/myth/grammar.ts';
import { CastSchema } from '../../src/render/cast.ts';
import { RigSchema } from '../../src/render/line/rig.ts';
import { PaletteSchema } from '../../src/render/palette.ts';
import { SceneSchema } from '../../src/render/scene.ts';
import { TuningSchema } from '../../src/sim/tuning.ts';
import { DiarySchema } from '../../src/story/diary.ts';
import { FlagsSchema } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import type { Chapter, Overrides } from '../../src/story/schema.ts';
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

/** Every creature id a chapter names: beats, bet options, the twist retry pair, diaries, and overrides. */
function creatureRefs(c: Chapter): string[] {
  const ids: string[] = [];
  const fromOverrides = (o: Overrides): void => {
    ids.push(
      ...Object.keys(o.positions ?? {}),
      ...Object.keys(o.dials ?? {}),
      ...Object.keys(o.state ?? {}).filter((id) => id !== '*'),
      ...(o.gone ?? []),
      ...(o.grudges ?? []).flatMap((g) => [g.holder, g.against]),
      ...Object.keys(o.danceThreshold ?? {}),
    );
  };
  for (const beat of c.beats) {
    if ('event' in beat.trigger && beat.trigger.who !== undefined) ids.push(beat.trigger.who);
    for (const a of beat.actions) {
      if ('focus' in a && a.focus !== null) ids.push(a.focus);
      else if ('arrange' in a) ids.push(...a.arrange);
      else if ('promptSkyBid' in a) ids.push(a.promptSkyBid);
      else if ('rumor' in a) ids.push(a.rumor.target, a.rumor.about);
      else if ('dance' in a) ids.push(a.dance);
    }
  }
  ids.push(...(c.bet?.options ?? []), ...(c.twist?.retryArrange ?? []), ...Object.keys(c.diary ?? {}));
  fromOverrides(c.overrides);
  for (const v of c.variants) fromOverrides(v.overrides);
  return ids;
}

/** Checks tuning, flags, diary, myth verses, rigs, palettes, scenes, cast, chapter camera names and creature ids, and Ink under `root/content`, and counts placeholder occurrences by kind. */
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
  const diaryPath = join(content, 'diary.json');
  if (existsSync(diaryPath)) {
    try {
      DiarySchema.parse(JSON.parse(readFileSync(diaryPath, 'utf8')));
    } catch (e) {
      errors.push(`diary.json: ${(e as Error).message}`);
    }
  }
  const versesPath = join(content, 'myth', 'verses.json');
  if (existsSync(versesPath)) {
    try {
      VersesSchema.parse(JSON.parse(readFileSync(versesPath, 'utf8')));
    } catch (e) {
      errors.push(`myth/verses.json: ${(e as Error).message}`);
    }
  }
  for (const f of filesIn(join(content, 'chapters'), '.json')) {
    try {
      ChapterSchema.parse(JSON.parse(readFileSync(join(content, 'chapters', f), 'utf8')));
    } catch (e) {
      errors.push(`${f}: ${(e as Error).message}`);
    }
  }
  try {
    AudioSchema.parse(JSON.parse(readFileSync(join(content, 'audio.json'), 'utf8')));
  } catch (e) {
    errors.push(`audio.json: ${(e as Error).message}`);
  }
  for (const [dir, schema] of [
    ['rigs', RigSchema],
    ['palettes', PaletteSchema],
    ['scenes', SceneSchema],
    ['cast', CastSchema],
    ['cast', VoiceSchema],
  ] as const) {
    for (const f of filesIn(join(content, dir), '.json')) {
      try {
        schema.parse(JSON.parse(readFileSync(join(content, dir, f), 'utf8')));
      } catch (e) {
        errors.push(`${f}: ${(e as Error).message}`);
      }
    }
  }
  // Chapters start from the m0 scenario (src/main.ts), so every creature id they name must be in it.
  const scenarioPath = join(content, 'scenarios', 'm0.json');
  const creatures = existsSync(scenarioPath)
    ? new Set(
        (JSON.parse(readFileSync(scenarioPath, 'utf8')) as { creatures: { id: string }[] }).creatures.map(
          (c) => c.id,
        ),
      )
    : null;
  // A chapter's `scene` names a file in content/scenes/, and every camera shot its beats name
  // must be one of that scene's cameras.
  for (const f of filesIn(join(content, 'chapters'), '.json')) {
    const parsed = ChapterSchema.safeParse(JSON.parse(readFileSync(join(content, 'chapters', f), 'utf8')));
    if (!parsed.success) continue;
    if (creatures) {
      for (const id of new Set(creatureRefs(parsed.data)))
        if (!creatures.has(id)) errors.push(`${f}: names creature ${id}, which scenario m0 lacks`);
    }
    const scenePath = join(content, 'scenes', `${parsed.data.scene}.json`);
    if (!existsSync(scenePath)) {
      errors.push(`${f}: scene ${parsed.data.scene} has no file content/scenes/${parsed.data.scene}.json`);
      continue;
    }
    const scene = SceneSchema.safeParse(JSON.parse(readFileSync(scenePath, 'utf8')));
    if (!scene.success) continue; // reported above
    for (const beat of parsed.data.beats) {
      for (const action of beat.actions) {
        if ('camera' in action && !(action.camera in scene.data.cameras)) {
          errors.push(
            `${f}: beat ${beat.id} names camera shot ${action.camera}, which scene ${parsed.data.scene} lacks`,
          );
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
