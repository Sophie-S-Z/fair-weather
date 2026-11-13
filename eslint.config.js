import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

// Module dependency table, spec 14.2. Each module lists the modules it may import as values.
// Type-only imports are allowed everywhere (allowTypeImports), which covers
// src/sim/types.ts and src/sim-host/protocol.ts.
const allowedValueImports = {
  sim: [],
  'sim-host': ['sim'],
  story: ['sim-host', 'content'],
  myth: ['content'],
  render: ['content'],
  ui: ['story'],
  input: ['story'],
  audio: ['content'],
  persist: ['sim', 'story'],
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
              message: `src/${mod} may not import ${banned.join(', ')} as values (spec 14.2).`,
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  };
});

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', '.superpowers/', 'docs/', '.claude/'] },
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
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['src/sim/**/*.ts'],
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
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='Math'][property.name!=/^(sqrt|floor|ceil|round|trunc|abs|min|max|sign|imul)$/]",
          message: 'src/sim may use only exact Math members (ADR 0001).',
        },
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message: 'src/sim may not use **: it is Math.pow, which is not exact in every engine (ADR 0001).',
        },
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
