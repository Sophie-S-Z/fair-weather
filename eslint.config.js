import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

// Module dependency table (ADR 0017). Each module lists the modules it may import as values.
// Type-only imports are allowed everywhere (allowTypeImports).
const allowedValueImports = {
  toy: ['content'],
  render: ['toy', 'content'],
  audio: [],
  persist: [],
  ui: ['toy', 'render', 'audio', 'persist', 'content'],
};
const allModules = [...Object.keys(allowedValueImports), 'content'];

const moduleBoundaryBlocks = Object.entries(allowedValueImports).map(([mod, allowed]) => {
  const banned = allModules.filter((m) => m !== mod && !allowed.includes(m));
  return {
    files: [`src/${mod}/**/*.{ts,svelte}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: banned.flatMap((m) => [`**/${m}`, `**/${m}/**`]),
              message: `src/${mod} may not import ${banned.join(', ')} as values (ADR 0017).`,
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  };
});

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      '.superpowers/',
      'docs/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } },
  },
  { files: ['tools/service-worker.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['src/toy/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'Date',
        'performance',
        'crypto',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
        'self',
        'window',
      ],
    },
  },
  ...moduleBoundaryBlocks,
  {
    files: ['content/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Program', message: 'content/ holds data only: no .ts files.' },
      ],
    },
  },
);
