import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import { inkPlugin } from '../../../tools/ink-plugin.ts';
import { findPlaceholders, placeholderGuard } from '../../../tools/content-validate/placeholder-guard.ts';
import { validateContent } from '../../../tools/content-validate/validate.ts';

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function buildFixture(name: string, mode: string): Promise<unknown> {
  return build({
    root: fixture(name),
    configFile: false,
    logLevel: 'silent',
    mode,
    plugins: [inkPlugin(), placeholderGuard()],
    build: { write: false },
  });
}

describe('findPlaceholders', () => {
  test('matches the three ADR 0010 markers', () => {
    expect(findPlaceholders('a PLACEHOLDER-pim.svg b #placeholder c [PLACEHOLDER] d')).toEqual([
      'PLACEHOLDER-',
      '#placeholder',
      '[PLACEHOLDER]',
    ]);
    expect(findPlaceholders('nothing here')).toEqual([]);
  });
});

describe('placeholderGuard', () => {
  test('fails a production build that imports a PLACEHOLDER file and names it', async () => {
    await expect(buildFixture('svg', 'production')).rejects.toThrow(/PLACEHOLDER-x\.svg/);
  });
  test('fails a production build whose Ink JSON holds #placeholder', async () => {
    await expect(buildFixture('ink', 'production')).rejects.toThrow(/#placeholder/);
  });
  test('fails a production build that imports an INCLUDEd .ink file with #placeholder', async () => {
    await expect(buildFixture('ink-source', 'production')).rejects.toThrow(/part\.ink/);
  });
  // The myth verses (content/myth/verses.json), and so the Book of Skies pages made from them.
  test('fails a production build that imports JSON content with [PLACEHOLDER] text and names it', async () => {
    await expect(buildFixture('json', 'production')).rejects.toThrow(/\[PLACEHOLDER\] in .*verses\.json/);
  });
  test('builds the JSON placeholder fixture in development mode', async () => {
    await expect(buildFixture('json', 'development')).resolves.toBeDefined();
  });
  test('builds the Ink placeholder fixture in development mode', async () => {
    await expect(buildFixture('ink-source', 'development')).resolves.toBeDefined();
  });
  test('builds a clean fixture', async () => {
    await expect(buildFixture('clean', 'production')).resolves.toBeDefined();
  });
  test('builds the placeholder fixture in development mode', async () => {
    await expect(buildFixture('svg', 'development')).resolves.toBeDefined();
  });
});

describe('validateContent', () => {
  test('reports a tuning file with a missing key, a bad rig, and an Ink error', () => {
    const { errors } = validateContent(fixture('bad-content'));
    expect(errors.some((e) => e.includes('tuning.json'))).toBe(true);
    expect(errors.some((e) => e.includes('bad.rig.json'))).toBe(true);
    expect(errors.some((e) => e.includes('bad.ink'))).toBe(true);
  });
  test('reports a bad chapter file', () => {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content', 'chapters'), { recursive: true });
    writeFileSync(join(root, 'content', 'chapters', 'bad.json'), JSON.stringify({ id: 'bad' }));
    const { errors } = validateContent(root);
    expect(errors.some((e) => e.startsWith('bad.json:'))).toBe(true);
  });
  test('reports a bad myth verses file', () => {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content', 'myth'), { recursive: true });
    writeFileSync(join(root, 'content', 'myth', 'verses.json'), JSON.stringify({ verses: [] }));
    const { errors } = validateContent(root);
    expect(errors.some((e) => e.startsWith('myth/verses.json:'))).toBe(true);
  });
  test('reports a bad sixth verse file', () => {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content', 'myth'), { recursive: true });
    writeFileSync(join(root, 'content', 'myth', 'sixth.json'), JSON.stringify({ templates: [] }));
    const { errors } = validateContent(root);
    expect(errors.some((e) => e.startsWith('myth/sixth.json:'))).toBe(true);
  });
  test('reports heroes out of HERO_KINDS order and a bad journal file', () => {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content'), { recursive: true });
    const heroes = JSON.parse(readFileSync(join(repoRoot, 'content', 'heroes.json'), 'utf8')) as unknown[];
    writeFileSync(join(root, 'content', 'heroes.json'), JSON.stringify(heroes.reverse()));
    writeFileSync(join(root, 'content', 'journal.json'), JSON.stringify({ saying: {}, stamp: {} }));
    const { errors } = validateContent(root);
    expect(errors.filter((e) => e.startsWith('heroes.json:'))).toEqual([
      'heroes.json: lists bellchime, seedcarrier, glassling, mosscoat, kite, lantern, not lantern, kite, mosscoat, glassling, seedcarrier, bellchime',
    ]);
    expect(errors.some((e) => e.startsWith('journal.json:'))).toBe(true);
  });
  test("compiles an INCLUDEd Ink file inside its includer, so it may use the includer's VARs", () => {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content', 'ink'), { recursive: true });
    const ink = (name: string, text: string) => {
      writeFileSync(join(root, 'content', 'ink', name), text);
    };
    ink('main.ink', 'VAR flag = true\nINCLUDE part.ink\n');
    ink('part.ink', '=== part ===\n{flag: yes | no}\n-> END\n');
    expect(validateContent(root).errors.filter((e) => e.includes('.ink'))).toEqual([]);
    ink('part.ink', '=== part ===\n{missing: yes | no}\n-> END\n');
    expect(validateContent(root).errors.some((e) => e.includes('missing'))).toBe(true);
  });
  /** A content root holding the repo's kith-meadow scene and ch1 changed by `edit`. */
  function chapterRoot(edit: (chapter: { scene: string; beats: { actions: object[] }[] }) => void): string {
    const root = mkdtempSync(join(tmpdir(), 'fw-content-'));
    mkdirSync(join(root, 'content', 'chapters'), { recursive: true });
    mkdirSync(join(root, 'content', 'scenes'), { recursive: true });
    const read = (path: string): string => readFileSync(join(repoRoot, 'content', path), 'utf8');
    writeFileSync(join(root, 'content', 'scenes', 'kith-meadow.json'), read('scenes/kith-meadow.json'));
    const chapter = JSON.parse(read('chapters/ch1.json')) as {
      scene: string;
      beats: { actions: object[] }[];
    };
    edit(chapter);
    writeFileSync(join(root, 'content', 'chapters', 'ch1.json'), JSON.stringify(chapter));
    return root;
  }
  test('accepts a chapter whose scene file has every camera shot it names', () => {
    expect(
      validateContent(chapterRoot(() => undefined)).errors.filter((e) => e.startsWith('ch1.json')),
    ).toEqual([]);
  });
  test('reports a chapter camera shot that its scene lacks', () => {
    const { errors } = validateContent(chapterRoot((c) => c.beats[0]?.actions.push({ camera: 'nowhere' })));
    expect(errors.some((e) => e.includes('camera shot nowhere, which scene kith-meadow lacks'))).toBe(true);
  });
  test('reports a creature id that the m0 scenario lacks', () => {
    const root = chapterRoot((c) => {
      c.beats[0]?.actions.push({ promptSkyBid: 'pym' }, { dance: 'pym' });
      Object.assign(c, {
        overrides: { grudges: [{ holder: 'moss', against: 'krut', slights: 1 }], state: { '*': 'sleep' } },
      });
    });
    mkdirSync(join(root, 'content', 'scenarios'), { recursive: true });
    writeFileSync(
      join(root, 'content', 'scenarios', 'm0.json'),
      readFileSync(join(repoRoot, 'content', 'scenarios', 'm0.json'), 'utf8'),
    );
    const errors = validateContent(root).errors.filter((e) => e.startsWith('ch1.json'));
    expect(errors).toEqual([
      'ch1.json: names creature pym, which scenario m0 lacks',
      'ch1.json: names creature krut, which scenario m0 lacks',
    ]);
  });
  test('reads creature ids from a bet on who or on a warmth, never from the options of a bet on a number', () => {
    const bet = (metric: object, options: string[], buckets?: number[]) => (c: object) =>
      Object.assign(c, { bet: { id: 'b', knot: 'k', options, metric, buckets, afterDays: 1 } });
    const errorsFor = (edit: (c: object) => void): string[] => {
      const root = chapterRoot(edit);
      mkdirSync(join(root, 'content', 'scenarios'), { recursive: true });
      writeFileSync(
        join(root, 'content', 'scenarios', 'm0.json'),
        readFileSync(join(repoRoot, 'content', 'scenarios', 'm0.json'), 'utf8'),
      );
      return validateContent(root).errors.filter((e) => e.startsWith('ch1.json'));
    };
    expect(errorsFor(bet({ kind: 'rumorShare' }, ['few', 'most'], [0.5]))).toEqual([]);
    expect(errorsFor(bet({ kind: 'maxShell', shell: 'tightness' }, ['pim', 'pym']))).toEqual([
      'ch1.json: names creature pym, which scenario m0 lacks',
    ]);
    expect(errorsFor(bet({ kind: 'warmth', from: 'echo', to: 'krut' }, ['no', 'yes'], [0]))).toEqual([
      'ch1.json: names creature krut, which scenario m0 lacks',
    ]);
  });
  test("checks a valley's creature ids and guide against its own scenario, allows the hero, and refuses shine in the Hollow", () => {
    const root = chapterRoot(() => undefined);
    const ch1 = JSON.parse(readFileSync(join(root, 'content', 'chapters', 'ch1.json'), 'utf8')) as {
      beats: { actions: object[] }[];
    };
    ch1.beats[0]?.actions.push({ focus: 'hero' }, { focus: 'pim' }, { postcard: true });
    const valley = {
      ...ch1,
      id: 'hollow',
      kind: 'valley',
      scenario: 'hollow',
      verbs: ['walk', 'shine'],
      valley: {
        pack: 'hollow',
        guide: 'tove',
        postcards: ['patience', 'listening'],
        keepsake: null,
        locals: [],
      },
    };
    mkdirSync(join(root, 'content', 'valleys'), { recursive: true });
    mkdirSync(join(root, 'content', 'scenarios'), { recursive: true });
    writeFileSync(join(root, 'content', 'valleys', 'hollow.json'), JSON.stringify(valley));
    const scenario = { creatures: [{ id: 'quill' }] };
    writeFileSync(join(root, 'content', 'scenarios', 'hollow.json'), JSON.stringify(scenario));
    expect(validateContent(root).errors.filter((e) => e.startsWith('hollow.json'))).toEqual([
      'hollow.json: names creature pim, which scenario hollow lacks',
      'hollow.json: names creature tove, which scenario hollow lacks',
      'hollow.json: a Hollow valley may not list shine',
    ]);
  });
  test('a Part 1 chapter may not name the hero', () => {
    const root = chapterRoot((c) => c.beats[0]?.actions.push({ focus: 'hero' }));
    mkdirSync(join(root, 'content', 'scenarios'), { recursive: true });
    writeFileSync(
      join(root, 'content', 'scenarios', 'm0.json'),
      readFileSync(join(repoRoot, 'content', 'scenarios', 'm0.json'), 'utf8'),
    );
    expect(validateContent(root).errors.filter((e) => e.startsWith('ch1.json'))).toEqual([
      'ch1.json: names creature hero, which scenario m0 lacks',
    ]);
  });
  test('reports a scenario a config names that has no file', () => {
    const { errors } = validateContent(chapterRoot((c) => Object.assign(c, { scenario: 'fenn' })));
    expect(errors).toContain('ch1.json: scenario fenn has no file content/scenarios/fenn.json');
  });
  test('reports a chapter that names a missing scene', () => {
    const { errors } = validateContent(chapterRoot((c) => (c.scene = 'no-such-scene')));
    expect(errors.some((e) => e.includes('scene no-such-scene has no file'))).toBe(true);
  });
  test('an Ink TODO note does not fail validation', () => {
    expect(validateContent(fixture('todo-content')).errors).toEqual([]);
  });
  test('counts each placeholder occurrence, not each file', () => {
    expect(validateContent(fixture('count-content')).counts).toEqual({
      'PLACEHOLDER-': 0,
      '#placeholder': 2,
      '[PLACEHOLDER]': 1,
    });
  });
  test('the CLI exits 1 on a bad content root and 0 on the repo', () => {
    const run = (root: string) =>
      spawnSync('node', ['tools/content-validate/validate.ts', root], { cwd: repoRoot, encoding: 'utf8' });
    expect(run(fixture('bad-content')).status).toBe(1);
    expect(run(repoRoot).status).toBe(0);
  });
});
