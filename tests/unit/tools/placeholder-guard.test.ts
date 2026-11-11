import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
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
    plugins: [placeholderGuard()],
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
