import { expect, test } from 'vitest';
import { spotLabel } from '../../../src/ui/tool-labels.ts';

test('a council stake id reads as a name with only its first letter capitalized', () => {
  expect(spotLabel('dry-hollow')).toBe('Dry hollow');
  expect(spotLabel('old-oak-ring')).toBe('Old oak ring');
  expect(spotLabel('pond')).toBe('Pond');
  expect(spotLabel('')).toBe('');
});
