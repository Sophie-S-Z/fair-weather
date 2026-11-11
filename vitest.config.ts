import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/science/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'property',
          include: ['tests/property/**/*.test.ts'],
          testTimeout: 600_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'golden',
          include: ['tests/golden/**/*.test.ts'],
        },
      },
    ],
  },
});
