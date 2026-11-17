import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import { findPlaceholders, placeholderGuard } from '../../../tools/content-validate/placeholder-guard.ts';

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

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

  test('fails a production build that imports JSON content with [PLACEHOLDER] text and names it', async () => {
    await expect(buildFixture('json', 'production')).rejects.toThrow(/\[PLACEHOLDER\] in .*notes\.json/);
  });
  test('builds the JSON placeholder fixture in development mode', async () => {
    await expect(buildFixture('json', 'development')).resolves.toBeDefined();
  });

  test('builds a clean fixture', async () => {
    await expect(buildFixture('clean', 'production')).resolves.toBeDefined();
  });
  test('builds the placeholder fixture in development mode', async () => {
    await expect(buildFixture('svg', 'development')).resolves.toBeDefined();
  });
});
